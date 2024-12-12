import { createContext, useEffect, useState } from 'react';
import { useStorageState } from './useStorageState';
import { User } from '@/types/user';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import axios from 'axios';
import RNFetchBlob from 'rn-fetch-blob';

import { LogInResponse, RequestParams } from '@/types/auth';
import { Farmer, ProductType, ProductTypeWithCompanyId } from '@/types/farmer';
import { CompanyInfo } from '@/types/company';
import { Country } from '@/types/country';
import { uuid } from 'expo-modules-core';
import { Plot } from '@/types/plot';
import { decode } from 'base-64';
import realm from '@/realm/useRealm';
import { FarmerSchema, PlotSchema } from '@/realm/schemas';

import guestCountries from '@/context/guestCountries.json';
import guestProductTypes from '@/context/guestProductTypes.json';
import { useSelectedFarmerState } from '@/state/state';

let creatingImageCacheDir: any = null;

export const AuthContext = createContext<{
  logIn: (username: string, password: string) => Promise<LogInResponse>;
  logOut: () => void;
  logInGuest: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  selectCompany: (company: number | string | null) => void;
  setNewPlot: (plot: Plot) => void;
  setInstance: (instance: string) => void;
  setDocumentationModal: (value: boolean) => void;
  refreshFarmers: (user: User) => Promise<void>;
  instance: string;
  makeRequest: ({ url, method, body, headers }: RequestParams) => Promise<any>;
  accessToken: string | null;
  user: User | null;
  selectedCompany: number | string | null;
  companies: (CompanyInfo | undefined)[] | string | null;
  productTypes: ProductTypeWithCompanyId[] | ProductType[] | string | null;
  countries: Country[] | string | null;
  guestAccess: boolean;
  isConnected: boolean;
  newPlot: Plot | null;
  documentationModal: boolean;
}>({
  logIn: async () => ({ success: false, errorStatus: '' }),
  logOut: () => null,
  logInGuest: async () => void 0,
  checkAuth: async () => false,
  makeRequest: async () => null,
  selectCompany: () => null,
  setNewPlot: () => null,
  setInstance: () => null,
  setDocumentationModal: () => null,
  refreshFarmers: async () => void 0,
  instance: process.env.EXPO_PUBLIC_API_URI ?? '',
  accessToken: null,
  user: null,
  companies: null,
  selectedCompany: null,
  productTypes: null,
  countries: null,
  guestAccess: false,
  isConnected: false,
  newPlot: null,
  documentationModal: false,
});

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(decode(token.split('.')[1]));
    const expirationDate = new Date(payload.exp * 1000);
    const currentDate = new Date();

    return expirationDate < currentDate;
  } catch (error) {
    console.error('Error decoding token:', error);
    return false;
  }
};

export function SessionProvider(props: React.PropsWithChildren<any>) {
  const [accessToken, setAccessToken] = useStorageState<string | null>(
    'access_token',
    null
  );
  const [user, setUser] = useStorageState<User | null>('user', null);
  const [selectedCompany, setSelectedCompany] = useStorageState<
    number | string | null
  >('selected_company', null, 'asyncStorage');
  const [companies, setCompanies] = useStorageState<
    (CompanyInfo | undefined)[] | string | null
  >('companies', null, 'asyncStorage');
  const [productTypes, setProductTypes] = useStorageState<
    ProductTypeWithCompanyId[] | ProductType[] | string | null
  >('product_type', null, 'asyncStorage');
  const [countries, setCountries] = useStorageState<Country[] | string | null>(
    'countries',
    null,
    'asyncStorage'
  );

  const [instance, setInstance] = useStorageState<string>(
    'instance',
    process.env.EXPO_PUBLIC_API_URI ?? ''
  );

  const { setSelectedFarmer } = useSelectedFarmerState();

  const [documentationModal, setDocumentationModal] = useState<boolean>(false);

  const [guestAccess, setGuestAccess] = useState<boolean>(false);

  useEffect(() => {
    if (instance === 'none') setInstance(process.env.EXPO_PUBLIC_API_URI ?? '');
  }, [instance]);

  useEffect(() => {
    if (!guestAccess && (productTypes === null || productTypes === 'none')) {
      setProductTypes(guestProductTypes as ProductType[]);
    }

    if (!guestAccess && (countries === null || countries === 'none')) {
      setCountries(guestCountries as Country[]);
    }
  }, [productTypes, countries]);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [newPlot, setNewPlot] = useState<Plot | null>(null);

  const checkAuth = async (): Promise<boolean> => {
    if (!(await NetInfo.fetch()).isConnected) {
      return true;
    }

    if (accessToken && !isTokenExpired(accessToken)) {
      return true;
    }

    return false;
  };

  const logIn = async (
    username: string,
    password: string
  ): Promise<LogInResponse> => {
    try {
      const responseLogin = await axios.post(`${instance}/api/user/login`, {
        username,
        password,
      });

      const setCookieHeader = responseLogin.headers['set-cookie'];

      if (setCookieHeader) {
        const accessToken = setCookieHeader[0]
          .split(',')[0]
          .split(';')[0]
          .split('=')[1];

        await setAccessToken(accessToken);

        const responseUserData = await axios.get(
          `${instance}/api/user/profile`
        );

        if (responseUserData.data.status === 'OK') {
          setGuestAccess(false);
          await deleteGuestFarmerIfNecessary();
          const user = responseUserData.data.data as User;
          await setUser(user);
          await setSelectedCompany(user.companyIds[0]);

          await fetchProductTypes(user);
          await fetchCountries();
          await fetchFarmers(user);

          const companyDetailsPromises = user.companyIds.map((companyId) =>
            axios.get(`${instance}/api/company/profile/${companyId}`)
          );

          const companyDetailsResponses = await Promise.all(
            companyDetailsPromises
          );

          const companyDetails = companyDetailsResponses.map(
            async (response) => {
              if (response.data.status === 'OK' && response.data.data.logo) {
                const logoFilePath = await downloadImageToFileSystem(
                  `${instance}/api/common/image/${response.data.data.logo.storageKey}/SMALL`,
                  accessToken
                );

                const companyInfo = {
                  id: response.data.data.id,
                  name: response.data.data.name,
                  logo: logoFilePath,
                } as CompanyInfo;
                return companyInfo;
              } else if (response.data.status === 'OK') {
                const companyInfo = {
                  id: response.data.data.id,
                  name: response.data.data.name,
                  logo: null,
                } as CompanyInfo;
                return companyInfo;
              }
            }
          );
          const companyDetailsResp = await Promise.all(companyDetails);

          await setCompanies(companyDetailsResp);

          return { success: true, errorStatus: '' };
        }
      }
    } catch (error: any) {
      if (error.response.data.status === 'AUTH_ERROR') {
        return { success: false, errorStatus: 'AUTH_ERROR' };
      } else {
        return { success: false, errorStatus: 'GENERIC_ERROR' };
      }
    }

    return { success: false, errorStatus: 'GENERIC_ERROR' };
  };

  const logOut = async () => {
    await setAccessToken(null);
    await setUser(null);
    await setSelectedCompany(null);
    await setCompanies(null);
    setSelectedFarmer(null);
    setNewPlot(null);
    setGuestAccess(false);

    await realm.realmDeleteAll(FarmerSchema, 'synced == true');

    clearImageCache();
  };

  const logInGuest = async () => {
    setGuestAccess(true);
    await setUser(null);
    await setSelectedCompany(null);
    await setCompanies(null);
    setSelectedFarmer(null);
    await setCountries(guestCountries as Country[]);
    await setProductTypes(guestProductTypes as any);

    const defaultFarmer = (await realm.realmRead(
      FarmerSchema,
      undefined,
      undefined,
      undefined,
      undefined,
      'id == "0"'
    )) as any;

    if (defaultFarmer.length === 0) {
      const farmerBody = {
        id: 0,
        companyId: 0,
        farmerCompanyInternalId: '0',
        type: 'FARMER',
        name: 'Guest',
        surname: 'Farmer',
        phone: '',
        email: '',
        hasSmartphone: false,
        gender: 'N_A',
        location: {
          address: {
            cell: '',
            sector: '',
            village: '',
            address: 'Address 123',
            city: 'City',
            state: 'State',
            zip: '1000',
            hondurasFarm: '',
            hondurasVillage: '',
            hondurasMunicipality: '',
            hondurasDepartment: '',
            country: {
              id: 83,
              code: 'DE',
              name: 'Germany',
            },
            otherAddress: '',
          },
        },
        bank: {
          accountHolderName: '',
          accountNumber: '',
          bankName: '',
          additionalInformation: '',
        },
        farm: {
          areaUnit: 'ha',
          totalCultivatedArea: 10,
          farmPlantInformationList: [],
          organic: false,
          areaOrganicCertified: 0,
          startTransitionToOrganic: '',
        },
        associations: [],
        cooperatives: [],
        certifications: [],
        productTypes: [],
        plots: [],
      };

      const farmerRealm = {
        id: '0',
        userId: '0',
        companyId: '0',
        data: JSON.stringify(farmerBody),
        name: 'Guest',
        surname: 'Farmer',
        synced: false,
      };

      await realm.realmWrite(FarmerSchema, farmerRealm);

      setSelectedFarmer(farmerBody);
    } else {
      setSelectedFarmer(JSON.parse(defaultFarmer[0].data));
    }
  };

  const deleteGuestFarmerIfNecessary = async () => {
    const farmers = (await realm.realmRead(
      FarmerSchema,
      undefined,
      undefined,
      undefined,
      undefined,
      'synced == false'
    )) as any;

    if (farmers.length === 1) {
      const plots = (await realm.realmRead(
        PlotSchema,
        undefined,
        undefined,
        undefined,
        undefined,
        'synced == false'
      )) as any;

      if (plots.length === 0) {
        await realm.realmDeleteOne(FarmerSchema, 'id == "0"');
      }
    }
  };

  const makeRequest = async ({ url, method, body, headers }: RequestParams) => {
    if (isTokenExpired(accessToken ?? '')) {
      logOut();
      return;
    }

    return await axios.request({
      url: instance + url,
      method,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
      data: body,
    });
  };

  const fetchProductTypes = async (user: User) => {
    const productTypesPromises = user.companyIds.map((companyId) =>
      axios
        .get(
          `${instance}/api/company/${companyId}/product-types?limit=1000&offset=0`
        )
        .then((response) => ({ response, companyId }))
    );

    const productTypesResponses = await Promise.all(productTypesPromises);

    const productTypes = productTypesResponses.map(
      async ({ response, companyId }) => {
        if (response.data.status === 'OK') {
          return { companyId, productTypes: response.data.data.items };
        }
      }
    );

    const productTypesResp = await Promise.all(productTypes);

    await setProductTypes(productTypesResp as any);
  };

  const fetchCountries = async () => {
    const countriesResponse = await axios.get(
      `${instance}/api/common/countries?requestType=FETCH&limit=500&sort=ASC`
    );
    const countriesResp = countriesResponse.data.data.items as Country[];
    await setCountries(countriesResp);
  };

  const fetchFarmers = async (user: User) => {
    await realm.realmDeleteAll(FarmerSchema, 'synced == true');
    const farmersPromises = user.companyIds.map((companyId) =>
      axios
        .get(
          `${instance}/api/company/userCustomers/${companyId}/FARMER?limit=5000`
        )
        .then((response) => ({ response, companyId }))
    );
    const farmersResponses = await Promise.all(farmersPromises);

    const farmers = farmersResponses.map(async ({ response, companyId }) => {
      if (response.data.status === 'OK') {
        return {
          companyId,
          farmers: response.data.data.items as Farmer[],
        };
      }
    });

    const farmersResp = await Promise.all(farmers);
    const farmersRealm: any = [];

    farmersResp.forEach((company) => {
      company?.farmers?.forEach((farmer) => {
        const farmerRealm = {
          id: farmer.id ? farmer.id.toString() : '',
          userId: user.id ? user.id.toString() : '',
          companyId: company?.companyId ? company?.companyId.toString() : '',
          data: JSON.stringify(farmer),
          name: farmer.name ? farmer.name : '',
          surname: farmer.surname ? farmer.surname : '',
          synced: true,
        };

        farmersRealm.push(farmerRealm);
      });
    });

    await realm.realmWriteMultiple(FarmerSchema, farmersRealm);
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state?.isConnected ?? false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        logIn,
        logOut,
        logInGuest,
        guestAccess,
        checkAuth,
        selectCompany: setSelectedCompany,
        makeRequest,
        accessToken,
        user,
        selectedCompany,
        companies,
        productTypes,
        countries,
        isConnected,
        newPlot,
        setNewPlot,
        instance,
        setInstance,
        setDocumentationModal,
        documentationModal,
        refreshFarmers: fetchFarmers,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
}

const downloadImageToFileSystem = async (url: string, accessToken: string) => {
  try {
    const { config, fs } = RNFetchBlob;
    const imageCacheDir = `${fs.dirs.CacheDir}/inatrace_images`;

    if (!creatingImageCacheDir) {
      creatingImageCacheDir = fs
        .exists(imageCacheDir)
        .then((exists) => {
          if (!exists) {
            return fs.mkdir(imageCacheDir);
          }
        })
        .catch((error) => {
          console.error('Directory check/create error:', error);
        })
        .finally(() => {
          creatingImageCacheDir = null;
        });

      await creatingImageCacheDir;
    } else {
      await creatingImageCacheDir;
    }

    const options = {
      path: `${imageCacheDir}/${uuid.v4()}.png`,
      HTTPHeader: {
        Cookie: accessToken,
      },
    };

    const res = await config(options).fetch('GET', url);
    const filePath = res.path();
    return 'file://' + filePath;
  } catch (error) {
    console.error('Error downloading and saving image:', error);
    return null;
  }
};

const clearImageCache = async () => {
  const { fs } = RNFetchBlob;
  const imageCacheDir = `${fs.dirs.CacheDir}/inatrace_images`;

  try {
    if (await fs.exists(imageCacheDir)) {
      await fs.unlink(imageCacheDir);
    }
  } catch (error) {
    console.error('Error clearing image cache directory:', error);
  }
};
