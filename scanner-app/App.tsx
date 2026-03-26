import React from 'react';
import { StatusBar } from 'react-native';
import ScanScreen from './src/screens/ScanScreen';

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScanScreen />
    </>
  );
}
