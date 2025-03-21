import { Text, Pressable, View } from 'react-native';
import { Link, useNavigation } from 'expo-router';
import { useContext, useEffect } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { ChevronLeft, User2 } from 'lucide-react-native';
import FarmerInformationGuest from '@/components/farmers/info/FarmerInformationGuest';
import FarmerInformation from '@/components/farmers/info/FarmerInformation';
import { useSelectedFarmerState } from '@/state/state';
import cn from '@/utils/cn';

export default function FarmersInfo() {
  const { guestAccess } = useContext(AuthContext) as {
    guestAccess: boolean;
  };
  const { selectedFarmer } = useSelectedFarmerState();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      title: `${selectedFarmer?.name ?? ''} ${selectedFarmer?.surname}`,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          className="flex flex-row items-center justify-center mr-3"
        >
          <ChevronLeft className="text-Orange" />
          <Text className="font-medium text-Orange text-[18px]">Back</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Link href="/user-settings" asChild>
          <Pressable>
            {({ pressed }) => (
              <View
                className={cn(
                  pressed ? 'bg-LightOrange' : 'bg-Orange',
                  'rounded-full p-[6px]'
                )}
              >
                <User2 size={14} className="text-White" />
              </View>
            )}
          </Pressable>
        </Link>
      ),
    });
  }, [selectedFarmer]);

  if (guestAccess) {
    return <FarmerInformationGuest />;
  }

  return <FarmerInformation selectedFarmer={selectedFarmer} />;
}
