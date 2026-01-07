import { useNavigation } from 'expo-router';
import { ChevronLeft, Pencil, RefreshCw, Download } from 'lucide-react-native';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import realm from '@/realm/useRealm';
import { FarmerSchema, PlotSchema } from '@/realm/schemas';
import i18n from '@/locales/i18n';
import cn from '@/utils/cn';
import { AuthContext } from '@/context/AuthContext';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { FullWindowOverlay } from 'react-native-screens';
import Selector from '@/components/common/Selector';
import { User } from '@/types/user';

export default function DataSync() {
  const navigation = useNavigation();
  const {
    isConnected,
    makeRequest,
    selectedCompany,
    user,
    guestAccess,
    instance,
    refreshFarmers,
  } = useContext(AuthContext) as {
    isConnected: boolean;
    makeRequest: any;
    selectedCompany: number;
    user: any;
    guestAccess: boolean;
    instance: string;
    refreshFarmers: (user: User) => Promise<void>;
  };

  const [farmersSynced, setFarmersSynced] = useState<any>([]);
  const [farmersToSync, setFarmersToSync] = useState<any>([]);
  const [plotsToSync, setPlotsToSync] = useState<any>([]);

  const [selectedPlots, setSelectedPlots] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [editingPlot, setEditingPlot] = useState<any>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['75%'], []);
  const containerComponent = useCallback(
    (props: any) => <FullWindowOverlay>{props.children}</FullWindowOverlay>,
    []
  );

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          className="flex flex-row items-center justify-center mr-3"
        >
          <ChevronLeft className="text-Orange" />
          <Text className="font-medium text-Orange text-[18px]">Back</Text>
        </Pressable>
      ),
    });

    getItemsToSync();
  }, []);

  const getItemsToSync = async () => {
    setLoading(true);
    try {
      const farmers = (await realm.realmRead(
        FarmerSchema,
        undefined,
        undefined,
        undefined,
        undefined,
        `(userId == '${user?.id}' OR userId == '0')`
      )) as any;
      const plots = (await realm.realmRead(
        PlotSchema,
        undefined,
        undefined,
        undefined,
        undefined,
        `(synced == false) AND (userId == '${user?.id}' OR userId == '0')`
      )) as any;

      let farmersDataSynced: any = [];
      let farmersData: any = [];
      let plotsData: any = [];

      for (const farmer of farmers) {
        const data = JSON.parse(farmer.data);
        if (farmer.synced) {
          farmersDataSynced.push({ ...farmer, data });
        } else {
          farmersData.push({ ...farmer, data });
        }
      }

      for (const plot of plots) {
        const data = JSON.parse(plot.data);
        plotsData.push({ ...plot, data });
      }

      setFarmersToSync(farmersData);
      setPlotsToSync(plotsData);
      setFarmersSynced(farmersDataSynced);

      setSelectedPlots(new Set());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlotSelection = (plotId: string) => {
    setSelectedPlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plotId)) {
        newSet.delete(plotId);
      } else {
        newSet.add(plotId);
      }
      return newSet;
    });
  };

  const toggleAllPlots = () => {
    if (selectedPlots.size === plotsToSync.length) {
      setSelectedPlots(new Set());
    } else {
      setSelectedPlots(new Set(plotsToSync.map((p: any) => p.id)));
    }
  };

  const syncData = async () => {
    if (!isConnected) {
      Alert.alert(
        i18n.t('synced.error'),
        i18n.t('synced.noConnection')
      );
      return;
    }

    if (selectedPlots.size === 0 && farmersToSync.length === 0) {
      Alert.alert(
        i18n.t('synced.error'),
        i18n.t('synced.noSelection')
      );
      return;
    }

    setSyncing(true);

    let syncedFarmersCount = 0;
    let syncedPlotsCount = 0;
    let failedFarmersCount = 0;
    let failedPlotsCount = 0;
    const errors: string[] = [];

    try {
      const selectedPlotsArray = plotsToSync.filter((p: any) =>
        selectedPlots.has(p.id)
      );

      let farmerPlots: any = [];

      const farmerPromises = farmersToSync.map(async (farmer: any) => {
        const fp = selectedPlotsArray.filter(
          (plot: any) => plot.farmerId === farmer.id
        );

        const farmerBody = {
          ...farmer.data,
          id: null,
          plots:
            fp?.map((plot: any) => {
              return {
                plotName: plot.data.plotName,
                crop: { id: parseInt(plot.data.crop, 10) },
                numberOfPlants: plot.data.numberOfPlants
                  ? parseInt(plot.data.numberOfPlants, 10)
                  : null,
                unit: plot.data.size.split(' ')[1],
                size: parseFloat(plot.data.size.split(' ')[0]),
                centerLatitude: parseFloat(plot.data.centerLatitude),
                centerLongitude: parseFloat(plot.data.centerLongitude),
                geoId: '',
                organicStartOfTransition: plot.data.organicStartOfTransition
                  ? plot.data.organicStartOfTransition
                  : null,
                certification: plot.data.certification
                  ? plot.data.certification
                  : null,
                coordinates: plot.data.featureInfo.geometry.coordinates[0].map(
                  (coordinate: number[]) => {
                    return {
                      latitude: coordinate[1],
                      longitude: coordinate[0],
                    };
                  }
                ),
              };
            }) ?? [],
        };

        farmerPlots = [...farmerPlots, ...fp];

        try {
          const result = await makeRequest({
            url: `/api/company/userCustomers/add/${selectedCompany}`,
            method: 'POST',
            body: farmerBody,
          });

          return {
            result,
            farmerId: farmer.id,
            plotIds: fp.map((plot: any) => plot.id),
            success: true,
          };
        } catch (error) {
          console.error('Farmer sync error:', error);
          return {
            result: null,
            farmerId: farmer.id,
            plotIds: fp.map((plot: any) => plot.id),
            success: false,
            error: error,
          };
        }
      });

      const farmerPromiseResults = await Promise.all(farmerPromises);

      for (const { result, farmerId, plotIds, success, error } of farmerPromiseResults) {
        if (success && result?.data?.status === 'OK') {
          await realm.realmUpdate(FarmerSchema, farmerId, 'synced', true);
          for (const plotId of plotIds) {
            await realm.realmDeleteOne(PlotSchema, `id == '${plotId}'`);
          }
          syncedFarmersCount++;
          syncedPlotsCount += plotIds.length;
        } else {
          failedFarmersCount++;
          failedPlotsCount += plotIds.length;
          errors.push(`Farmer ${farmerId}: ${error?.message || 'Unknown error'}`);
        }
      }

      const plotsLeft = selectedPlotsArray.filter(
        (plot: any) => !farmerPlots.includes(plot)
      );

      const plotPromises = plotsLeft.map(async (plot: any) => {
        const plotBody = {
          plotName: plot.data.plotName,
          crop: { id: parseInt(plot.data.crop, 10) },
          numberOfPlants: plot.data.numberOfPlants
            ? parseInt(plot.data.numberOfPlants, 10)
            : null,
          unit: plot.data.size.split(' ')[1],
          size: parseFloat(plot.data.size.split(' ')[0]),
          centerLatitude: parseFloat(plot.data.centerLatitude),
          centerLongitude: parseFloat(plot.data.centerLongitude),
          geoId: '',
          organicStartOfTransition: plot.data.organicStartOfTransition
            ? plot.data.organicStartOfTransition
            : null,
          certification: plot.data.certification
            ? plot.data.certification
            : null,
          coordinates: plot.data.featureInfo.geometry.coordinates[0].map(
            (coordinate: number[]) => {
              return {
                latitude: coordinate[1],
                longitude: coordinate[0],
              };
            }
          ),
        };

        try {
          const result = await makeRequest({
            url: `/api/company/userCustomers/${plot.farmerId.toString()}/plots/add`,
            method: 'POST',
            body: plotBody,
          });

          return {
            result,
            plotId: plot.id,
            success: true,
          };
        } catch (error) {
          console.error('Plot sync error:', error);
          return {
            result: null,
            plotId: plot.id,
            success: false,
            error: error,
          };
        }
      });

      const plotPromiseResults = await Promise.all(plotPromises);

      for (const { result, plotId, success, error } of plotPromiseResults) {
        if (success && result?.data?.status === 'OK') {
          await realm.realmDeleteOne(PlotSchema, `id == '${plotId}'`);
          syncedPlotsCount++;
        } else {
          failedPlotsCount++;
          errors.push(`Plot ${plotId}: ${error?.message || 'Unknown error'}`);
        }
      }

      await getItemsToSync();

      if (failedFarmersCount === 0 && failedPlotsCount === 0) {
        Alert.alert(
          i18n.t('synced.syncedTitle'),
          `${i18n.t('synced.syncedMessage')}\n${syncedFarmersCount} ${i18n.t('farmers.title')}, ${syncedPlotsCount} ${i18n.t('plots.title')}`
        );
      } else if (syncedFarmersCount > 0 || syncedPlotsCount > 0) {
        Alert.alert(
          i18n.t('synced.partialSuccess'),
          `${i18n.t('synced.synced')}: ${syncedFarmersCount} ${i18n.t('farmers.title')}, ${syncedPlotsCount} ${i18n.t('plots.title')}\n${i18n.t('synced.failed')}: ${failedFarmersCount} ${i18n.t('farmers.title')}, ${failedPlotsCount} ${i18n.t('plots.title')}`
        );
      } else {
        Alert.alert(
          i18n.t('synced.error'),
          `${i18n.t('synced.allFailed')}\n${errors.slice(0, 3).join('\n')}`
        );
      }

    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert(
        i18n.t('synced.error'),
        i18n.t('synced.errorMessage') + ': ' + (error as Error).message
      );
    } finally {
      setSyncing(false);
    }
  };

  const exportToExcel = async () => {
    const hasDataToExport = selectedPlots.size > 0 || farmersToSync.length > 0;

    if (!hasDataToExport) {
      Alert.alert(
        i18n.t('synced.exportError'),
        i18n.t('synced.noDataToExport')
      );
      return;
    }

    setExporting(true);

    try {
      const plotsToExport = selectedPlots.size > 0
        ? plotsToSync.filter((p: any) => selectedPlots.has(p.id))
        : plotsToSync;

      const excelData: any[] = [];

      for (const farmer of farmersToSync) {
        const farmerPlots = plotsToExport.filter(
          (plot: any) => plot.farmerId === farmer.id
        );

        const baseRow = {
          'Farmer Name': farmer.data.name || '',
          'Farmer Surname': farmer.data.surname || '',
          'Gender': farmer.data.gender || '',
          'Date of Birth': farmer.data.dateOfBirth || '',
          'Village': farmer.data.village || '',
          'Cell': farmer.data.cell || '',
          'Phone': farmer.data.phone || '',
          'Email': farmer.data.email || '',
          'Farm Name': farmer.data.farm || '',
          'Area Unit': farmer.data.areaUnit || '',
          'Total Area': farmer.data.totalCultivatedArea || '',
          'Organic Production': farmer.data.organicProduction ? 'Yes' : 'No',
        };

        if (farmerPlots.length > 0) {
          for (const plot of farmerPlots) {
            excelData.push({
              ...baseRow,
              'Plot Name': plot.data.plotName || '',
              'Crop': plot.data.crop || '',
              'Plot Size': plot.data.size ? plot.data.size.split(' ')[0] : '',
              'Plot Unit': plot.data.size ? plot.data.size.split(' ')[1] : '',
              'Number of Plants': plot.data.numberOfPlants || '',
              'Latitude': plot.data.centerLatitude || '',
              'Longitude': plot.data.centerLongitude || '',
              'Organic Start': plot.data.organicStartOfTransition || '',
              'Certification': plot.data.certification || '',
            });
          }
        } else {
          excelData.push({
            ...baseRow,
            'Plot Name': '',
            'Crop': '',
            'Plot Size': '',
            'Plot Unit': '',
            'Number of Plants': '',
            'Latitude': '',
            'Longitude': '',
            'Organic Start': '',
            'Certification': '',
          });
        }
      }

      const orphanPlots = plotsToExport.filter(
        (plot: any) => !farmersToSync.find((f: any) => f.id === plot.farmerId)
      );

      for (const plot of orphanPlots) {
        const farmer = farmersSynced.find(
          (f: any) => f.id === plot.farmerId
        );

        excelData.push({
          'Farmer Name': farmer?.data?.name || '',
          'Farmer Surname': farmer?.data?.surname || '',
          'Gender': farmer?.data?.gender || '',
          'Date of Birth': farmer?.data?.dateOfBirth || '',
          'Village': farmer?.data?.village || '',
          'Cell': farmer?.data?.cell || '',
          'Phone': farmer?.data?.phone || '',
          'Email': farmer?.data?.email || '',
          'Farm Name': farmer?.data?.farm || '',
          'Area Unit': farmer?.data?.areaUnit || '',
          'Total Area': farmer?.data?.totalCultivatedArea || '',
          'Organic Production': farmer?.data?.organicProduction ? 'Yes' : 'No',
          'Plot Name': plot.data.plotName || '',
          'Crop': plot.data.crop || '',
          'Plot Size': plot.data.size ? plot.data.size.split(' ')[0] : '',
          'Plot Unit': plot.data.size ? plot.data.size.split(' ')[1] : '',
          'Number of Plants': plot.data.numberOfPlants || '',
          'Latitude': plot.data.centerLatitude || '',
          'Longitude': plot.data.centerLongitude || '',
          'Organic Start': plot.data.organicStartOfTransition || '',
          'Certification': plot.data.certification || '',
        });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      const columnWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
        { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
        { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
        { wch: 15 },
      ];
      ws['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Farmers and Plots');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `farmers_plots_export_${timestamp}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: i18n.t('synced.exportTitle'),
          UTI: 'com.microsoft.excel.xlsx',
        });

        Alert.alert(
          i18n.t('synced.exportSuccess'),
          i18n.t('synced.exportSuccessMessage')
        );
      } else {
        Alert.alert(
          i18n.t('synced.exportError'),
          i18n.t('synced.sharingNotAvailable')
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        i18n.t('synced.exportError'),
        i18n.t('synced.exportErrorMessage') + ': ' + (error as Error).message
      );
    } finally {
      setExporting(false);
    }
  };

  const handleEditPlot = (plot: any) => {
    setEditingPlot(plot);
    bottomSheetRef.current?.present();
  };

  const updatePlotFarmerId = async (farmerId: number) => {
    if (editingPlot) {
      await realm.realmUpdate(PlotSchema, editingPlot.id, 'farmerId', farmerId);
      setEditingPlot({ ...editingPlot, farmerId });
      await getItemsToSync();
    }
  };

  const openLink = async () => {
    const url = instance.includes('pro') ? 'https://inatrace.pro' : instance;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      Linking.openURL(url);
    } else {
      console.error('Cannot open URL:', url);
    }
  };

  const farmerRefresh = async () => {
    await refreshFarmers(user);
    await getItemsToSync();
  };

  const hasDataToSync = farmersToSync.length > 0 || plotsToSync.length > 0;

  return (
    <View>
      {guestAccess ? (
        <View className="p-5">
          <Text className="text-lg">{i18n.t('synced.guestWarning')}</Text>
          <Pressable
            onPress={() => openLink()}
            className="self-start px-3 py-2 mx-auto my-5 rounded-md bg-Orange"
          >
            <Text className="text-lg text-White">INATrace</Text>
          </Pressable>
        </View>
      ) : (
        <View className="h-full">
          <ScrollView className="flex flex-col h-full pt-5 bg-White">
            <Text className="text-[18px] font-medium mx-5">
              {i18n.t('farmers.title')}
            </Text>
            {loading ? (
              <View className="flex flex-row items-center justify-center p-5 py-10">
                <Text className="text-[16px] font-medium">
                  {i18n.t('loading')}
                </Text>
              </View>
            ) : farmersToSync.length > 0 ? (
              <View className="flex flex-col mx-5 mt-5 border rounded-md border-LightGray bg-White">
                {farmersToSync.map((f: any, index: number) => (
                  <View
                    className={cn(
                      'border-b border-b-LightGray',
                      index === farmersToSync.length - 1 && 'border-b-0'
                    )}
                    key={index}
                  >
                    <View className="flex flex-row items-center justify-between py-4 pr-4 ml-4">
                      <View className="max-w-[45%]">
                        <Text className="font-bold">
                          {i18n.t('synced.name')}
                        </Text>
                        <Text>
                          {f?.name ?? ''}
                          {f?.name ? ' ' : ''}
                          {f?.surname}
                        </Text>
                      </View>
                      <View
                        className={cn(
                          'py-0.5 px-1.5 border rounded-full',
                          f.userId === '0'
                            ? 'bg-Orange/20 border-Orange'
                            : 'bg-Green/20 border-Green'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-[12px]',
                            f.userId === '0' ? 'text-Orange' : 'text-Green'
                          )}
                        >
                          {f.userId === '0'
                            ? i18n.t('synced.guestMode')
                            : i18n.t('synced.offlineMode')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex flex-row items-center justify-center p-5 py-10">
                <Text className="text-[16px] font-medium">
                  {i18n.t('synced.noFarmers')}
                </Text>
              </View>
            )}

            <View className="flex flex-row items-center justify-between mx-5 mt-5">
              <Text className="text-[18px] font-medium">
                {i18n.t('plots.title')}
              </Text>
              {plotsToSync.length > 0 && (
                <Pressable onPress={toggleAllPlots}>
                  <Text className="text-Orange font-medium">
                    {selectedPlots.size === plotsToSync.length
                      ? i18n.t('synced.deselectAll')
                      : i18n.t('synced.selectAll')}
                  </Text>
                </Pressable>
              )}
            </View>

            {loading ? (
              <View className="flex flex-row items-center justify-center p-5 py-10">
                <Text className="text-[16px] font-medium">
                  {i18n.t('loading')}
                </Text>
              </View>
            ) : plotsToSync.length > 0 ? (
              <View className="flex flex-col mx-5 mt-5 mb-5 border rounded-md border-LightGray bg-White">
                {plotsToSync.map((p: any, index: number) => {
                  const farmerDisplay = [
                    ...farmersToSync,
                    ...farmersSynced,
                  ].find((fds: any) => fds.id === p.farmerId);

                  const isSelected = selectedPlots.has(p.id);

                  return (
                    <Pressable
                      key={index}
                      onPress={() => togglePlotSelection(p.id)}
                      className={cn(
                        'border-b border-b-LightGray py-4',
                        index === plotsToSync.length - 1 && 'border-b-0',
                        isSelected && 'bg-Orange/10'
                      )}
                    >
                      <View className="flex flex-row items-center justify-between pr-4 ml-4">
                        <View className="flex flex-row items-center flex-1">
                          <View
                            className={cn(
                              'w-5 h-5 border-2 rounded mr-3',
                              isSelected
                                ? 'bg-Orange border-Orange'
                                : 'border-LightGray'
                            )}
                          >
                            {isSelected && (
                              <Text className="text-White text-center text-[12px]">
                                ✓
                              </Text>
                            )}
                          </View>
                          <View className="max-w-[60%]">
                            <Text className="font-bold">
                              {i18n.t('synced.name')}
                            </Text>
                            <Text>{p.data.plotName}</Text>
                          </View>
                        </View>
                        <View
                          className={cn(
                            'py-0.5 px-1.5 border rounded-full',
                            p.userId === '0'
                              ? 'bg-Orange/20 border-Orange'
                              : 'bg-Green/20 border-Green'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-[12px]',
                              p.userId === '0' ? 'text-Orange' : 'text-Green'
                            )}
                          >
                            {p.userId === '0'
                              ? i18n.t('synced.guestMode')
                              : i18n.t('synced.offlineMode')}
                          </Text>
                        </View>
                      </View>
                      <View className="flex flex-row items-center justify-between pr-4 mt-2 ml-4">
                        <View className="max-w-[60%] ml-8">
                          <Text className="font-bold">
                            {i18n.t('synced.syncToFarmer')}
                          </Text>
                          <Text>
                            {farmerDisplay?.name ?? ''}
                            {farmerDisplay?.name ? ' ' : ''}
                            {farmerDisplay?.surname}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleEditPlot(p)}>
                          <Pencil className="text-Orange" size={18} />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View className="flex flex-row items-center justify-center p-5 py-10">
                <Text className="text-[16px] font-medium">
                  {i18n.t('synced.noPlots')}
                </Text>
              </View>
            )}
          </ScrollView>

          <BottomSheetModal
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={(props) => (
              <BottomSheetBackdrop
                {...props}
                onPress={() => bottomSheetRef.current?.close()}
                disappearsOnIndex={-1}
              />
            )}
            enableDismissOnClose={true}
            containerComponent={
              Platform.OS === 'ios' ? containerComponent : undefined
            }
          >
            <BottomSheetScrollView className="rounded-t-md">
              <Pressable
                onPress={farmerRefresh}
                className="self-start px-4 py-2 mx-5 rounded-md bg-Orange"
              >
                <Text className="text-white">
                  {i18n.t('farmers.refreshFarmers')}
                </Text>
              </Pressable>
              <Selector
                items={
                  [...farmersSynced, ...farmersToSync]?.map((f) => ({
                    label: `${f?.name ?? ''}${f?.name ? ' ' : ''}${f?.surname}`,
                    value: f?.id,
                  })) ?? []
                }
                selected={editingPlot?.farmerId}
                setSelected={updatePlotFarmerId}
              />
            </BottomSheetScrollView>
          </BottomSheetModal>

          <View className="pb-5 bg-White">
            {hasDataToSync && (
              <Pressable
                className="mb-2"
                onPress={exportToExcel}
                disabled={exporting}
              >
                {({ pressed }) => (
                  <View
                    className={cn(
                      pressed || exporting ? 'bg-LightGray' : 'bg-Gray',
                      'flex flex-row mx-5 p-3 items-center justify-center rounded-md h-[48px]'
                    )}
                  >
                    {exporting ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Download className="text-White" />
                    )}
                    <View className="w-2" />
                    <Text className="text-[16px] text-White font-semibold">
                      {i18n.t('synced.exportToExcel')}
                      {selectedPlots.size > 0 && ` (${selectedPlots.size})`}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={syncData}
              disabled={
                !isConnected ||
                (selectedPlots.size === 0 && farmersToSync.length === 0)
              }
            >
              {({ pressed }) => (
                <View
                  className={cn(
                    pressed ||
                      !isConnected ||
                      (selectedPlots.size === 0 && farmersToSync.length === 0)
                      ? 'bg-LightOrange'
                      : 'bg-Orange',
                    'flex flex-row mx-5 p-3 items-center justify-center rounded-md h-[48px]'
                  )}
                >
                  {syncing ? (
                    <ActivityIndicator />
                  ) : (
                    <RefreshCw className="text-White" />
                  )}
                  <View className="w-2" />
                  <Text className="text-[16px] text-White font-semibold">
                    {i18n.t('home.syncData')}
                    {selectedPlots.size > 0 && ` (${selectedPlots.size})`}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}