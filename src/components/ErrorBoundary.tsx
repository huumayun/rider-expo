import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught:', error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>💥</Text>
        <Text style={styles.title}>
          {this.props.fallbackTitle || 'Something went wrong'}
        </Text>
        <Text style={styles.message} numberOfLines={4}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </Text>
        <TouchableOpacity onPress={this.reset} style={styles.btn}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#07070f',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize: 20, fontWeight: '800',
    color: '#f8fafc', textAlign: 'center',
  },
  message: {
    fontSize: 13, color: '#64748b',
    textAlign: 'center', lineHeight: 20,
  },
  btn: {
    marginTop: 8, backgroundColor: '#22d47a',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
