import React from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PackageCheck, ChevronLeft } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';
import { Order } from '../../../store/orderStore';

interface Props {
  order: Order;
  onNext: () => void;
  updating: boolean;
}

export default function PickedSuccess({ order, onNext, updating }: Props) {
  const { T, font, t } = useApp();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: T.border }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')} style={{ padding: 8, marginRight: 8 }}>
          <ChevronLeft size={24} color={T.text} />
        </Pressable>
        <Text style={{ color: T.text, fontFamily: font, fontSize: 20, fontWeight: '700' }}>
          #{order.id.slice(-6).toUpperCase()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24, backgroundColor: T.cardA }}>
            <PackageCheck size={48} color={T.accent} />
          </View>
          <Text style={{ color: T.text, fontFamily: font, fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
            Picked Successfully!
          </Text>
          <Text style={{ color: T.sub, fontFamily: font, fontSize: 16, textAlign: 'center', marginTop: 12 }}>
            You have successfully picked up the order from {order.branchName}.
          </Text>
        </View>
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderColor: T.border, backgroundColor: T.bg }}>
        <Pressable
          onPress={onNext}
          disabled={updating}
          style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: T.accent, opacity: updating ? 0.7 : 1 }}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontFamily: font, fontSize: 16, fontWeight: '700' }}>
              {t('flow_picked')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
