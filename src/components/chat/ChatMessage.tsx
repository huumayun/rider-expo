import React, { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Check, CheckCheck, X, ZoomIn } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

const formatTime = (ts: any) => {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatMessage({ message, isOwn }: { message: any; isOwn: boolean }) {
  const { T, theme, font } = useApp();
  const isDark = theme === 'dark';
  const surf = isDark ? '#141428' : '#f0f0f8';

  const [lightbox, setLightbox] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const displayImage = message.imageUrl || message.image;
  const isImage = !!displayImage;
  const isUnread = !isOwn && !message.read;

  return (
    <>
      <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 10, paddingHorizontal: 16 }}>
        
        {!isOwn && (
          <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 4, marginLeft: 4, opacity: 0.5, fontFamily: font }}>
            {message.senderName || 'Customer'}
          </Text>
        )}

        <View style={{
          maxWidth: '84%',
          backgroundColor: isOwn ? T.accent : surf,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: isOwn ? 4 : 20,
          borderBottomLeftRadius: isOwn ? 20 : 4,
          borderWidth: !isOwn && isUnread ? 1 : 0,
          borderColor: `${T.accent}40`,
          overflow: 'hidden'
        }}>
          
          {isUnread && (
            <View style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.accent }} />
          )}

          {isImage && !hasError && (
            <Pressable onPress={() => setLightbox(true)} style={{ padding: 4, position: 'relative' }}>
              <Image 
                source={{ uri: displayImage }} 
                style={{ width: 180, height: 240, borderRadius: 14 }}
                onLoadStart={() => setIsLoaded(false)}
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
              />
              {!isLoaded && (
                <View style={{ position: 'absolute', inset: 4, borderRadius: 14, backgroundColor: isOwn ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={isOwn ? '#fff' : T.accent} />
                </View>
              )}
              {isLoaded && (
                <View style={{ position: 'absolute', inset: 4, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', opacity: 0 }}>
                  <ZoomIn size={18} color="#fff" />
                </View>
              )}
            </Pressable>
          )}

          {message.text ? (
            <View style={{ padding: isUnread ? 10 : 10, paddingRight: isUnread ? 26 : 14, paddingLeft: 14 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: isOwn ? '#fff' : T.text, fontWeight: '500', fontFamily: font }}>
                {message.text}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: 12, paddingBottom: 8, marginTop: isImage && !message.text ? 4 : -6, opacity: 0.8 }}>
            <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', color: isOwn ? 'rgba(255,255,255,0.6)' : T.sub, fontFamily: font }}>
              {formatTime(message.timestamp)}
            </Text>
            {isOwn && (
              message.read
                ? <CheckCheck size={11} color="#fff" strokeWidth={3} />
                : <Check size={11} color="rgba(255,255,255,0.5)" strokeWidth={3} />
            )}
          </View>

        </View>
      </View>

      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable onPress={() => setLightbox(false)} style={{ position: 'absolute', top: 40, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <Image source={{ uri: displayImage }} style={{ width: '90%', height: '80%', resizeMode: 'contain' }} />
        </View>
      </Modal>
    </>
  );
}
