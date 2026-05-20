import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { NoInternet } from '../NoInternet';

export function MainLayout({ children }: { children: ReactNode }) {
  const { T } = useApp();
  
  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {children}
      <NoInternet />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});
