import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { QUICK_MESSAGES } from './chatConfig';
import { useApp } from '../../context/AppContext';

export default function QuickMessages({ onSelect }: { onSelect: (msg: string) => void }) {
  const { T, lang, theme, font } = useApp();
  const isDark = theme === 'dark';
  const surfHi = isDark ? '#141428' : '#f4f4f9';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      {QUICK_MESSAGES.map(msg => (
        <Pressable
          key={msg.id}
          onPress={() => onSelect(lang === 'bn' ? msg.text_bn : msg.text_en)}
          style={({ pressed }) => ({
            backgroundColor: surfHi,
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: 99,
            paddingHorizontal: 14,
            paddingVertical: 8,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            opacity: pressed ? 0.8 : 1
          })}
        >
          <Text style={{ color: T.text, fontSize: 12, fontWeight: '700', fontFamily: font }}>
            {lang === 'bn' ? msg.text_bn : msg.text_en}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
