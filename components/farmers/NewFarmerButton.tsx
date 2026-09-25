import { ShadowButtonStyle } from '@/constants/Shadow';
import i18n from '@/locales/i18n';
import cn from '@/utils/cn';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, View, Text } from 'react-native';
import React from 'react';
import { User } from '@/types/user';
// import { AuthContext } from '@/context/AuthContext';

export default function NewFarmerButton() {
  //const { user } = useAuth();

  // Si l'utilisateur n'est pas connecté, ne rien afficher
  // if (!user) {
  //   return null;
  // }

  // // Si l'utilisateur est connecté mais avec le rôle USER, ne rien afficher
  // if (user.role === 'USER') {
  //   return null;
  // }

  return (
    <Link href="/(app)/(farmers)/new-farmer" className="mb-5" asChild>
      <Pressable>
        {({ pressed }) => (
          <View
            className={cn(
              pressed ? 'bg-Orange' : 'bg-Orange',
              'flex flex-row m-5 p-3 items-center justify-center rounded-md'
            )}
          >
            <Plus className="text-White" />
            <View className="w-2" />
            <Text className="text-[16px] text-White font-semibold">
              {i18n.t('farmers.newFarmer')}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

// Any signed-in user may add farmers from the field (register #3). Farmers added by collectors
// reach the server as PENDING and wait for a company admin to validate them, so the button is no
// longer limited to admins. Guest (demo) sessions do not get it.
export const ButtonWrapper = ({
  children,
  user,
  guestAccess,
}: {
  children: React.ReactNode;
  user: User | null;
  guestAccess?: boolean;
}) => {
  if (!user || guestAccess) {
    return null;
  }

  return (
    <View className="absolute bottom-0 w-full" style={ShadowButtonStyle}>
      {children}
    </View>
  );
};
