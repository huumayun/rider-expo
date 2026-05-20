import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { CheckCircle2, PackageSearch, ShoppingBag, ClipboardList, Check, Banknote, Camera, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../../context/AppContext';

const ParcelPhoto = React.memo(({ ord, pickupPhotos, isCompressing, handleCapture, removePhoto, T, lang, txt, sub }: any) => {
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, opacity: 0.8 }}>
        <Camera size={10} color={sub} />
        <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: sub }}>
          {lang === 'bn' ? 'পার্সেলের ছবি' : 'Parcel Photo'}
        </Text>
      </View>

      <Pressable
        onPress={() => !pickupPhotos[ord.id] && handleCapture(ord.id)}
        style={{
          width: '100%', height: pickupPhotos[ord.id] ? 160 : 70,
          borderRadius: 18, backgroundColor: pickupPhotos[ord.id] ? T.hi : `${T.accent}05`,
          borderWidth: 1.5, borderStyle: 'dashed', borderColor: pickupPhotos[ord.id] ? T.green : isCompressing === ord.id ? T.accent : T.border,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}
      >
        {isCompressing === ord.id ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: sub }}>{lang === 'bn' ? 'প্রসেসিং...' : 'Processing...'}</Text>
          </View>
        ) : pickupPhotos[ord.id] ? (
          <>
            <Image source={{ uri: pickupPhotos[ord.id].previewUrl }} style={{ width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6 }}>
              <CheckCircle2 size={14} color={T.green} strokeWidth={3} />
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>{lang === 'bn' ? 'ছবি তোলা হয়েছে' : 'PHOTO TAKEN'}</Text>
            </View>
            <Pressable
              onPress={() => removePhoto(ord.id)}
              style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,50,50,0.9)', alignItems: 'center', justifyContent: 'center' }}
            >
              <RotateCcw size={14} color="#fff" strokeWidth={3} />
            </Pressable>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${T.accent}12`, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={18} color={T.accent} />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '900', color: txt }}>{lang === 'bn' ? 'ছবি তুলুন' : 'TAP TO TAKE PHOTO'}</Text>
              <Text style={{ fontSize: 8, fontWeight: '700', color: sub, opacity: 0.7 }}>{lang === 'bn' ? 'প্যাকেজ হস্তান্তরের আগে' : 'Required before picking up'}</Text>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
});

const OrderItem = React.memo(({ item, orderId, idx, isChecked, toggleCheck, T, lang, txt, sub, cardBg, brd, isDark }: any) => {
  return (
    <Pressable
      onPress={() => toggleCheck(orderId, idx)}
      style={{
        paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18,
        backgroundColor: isChecked ? `${T.accent}12` : cardBg,
        borderWidth: 1, borderColor: isChecked ? `${T.accent}44` : brd,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      {isChecked && (
        <View style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3, backgroundColor: T.accent, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 52, height: 52, borderRadius: 14, overflow: 'hidden',
          borderWidth: 1, borderColor: isChecked ? 'rgba(59,130,246,.3)' : brd,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: T.hi
        }}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', opacity: isChecked ? 1 : 0.6 }} />
          ) : (
            <ShoppingBag size={22} color={isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.15)'} strokeWidth={1.5} />
          )}
          <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: T.accent, paddingVertical: 2, paddingHorizontal: 5, borderBottomLeftRadius: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>x{item.qty || item.quantity}</Text>
          </View>
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: isChecked ? T.accent : txt, marginBottom: 3 }}>
            {lang === 'bn' ? (item.name_bn || item.name_en || item.name) : (item.name_en || item.name_bn || item.name)}
          </Text>
          {!item.selectedVariation && (
            <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: sub }}>
              {lang === 'bn' ? (item.unit_bn || item.unit_en || 'Unit') : (item.unit_en || item.unit_bn || 'Unit')}
            </Text>
          )}
          {item.selectedVariation && (
            <View style={{ backgroundColor: `${T.accent}12`, alignSelf: 'flex-start', paddingVertical: 1, paddingHorizontal: 6, borderRadius: 6, marginTop: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: T.accent }}>
                {lang === 'bn' ? item.selectedVariation.label_bn : item.selectedVariation.label_en}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: isChecked ? T.accent : T.hi,
        borderWidth: 1, borderColor: isChecked ? T.accent : brd,
      }}>
        {isChecked ? (
          <Check size={18} color="#fff" strokeWidth={3} />
        ) : (
          <CheckCircle2 size={16} color={sub} strokeWidth={1.5} />
        )}
      </View>
    </Pressable>
  );
});

export default function ArrivedAtBranchView({ order, batchOrders, onPhotosChange, onVerificationStatusChange }: any) {
  const { T, theme, lang, font } = useApp();

  const ordersList = useMemo(() => {
    const list = batchOrders && batchOrders.length > 0 ? batchOrders : [order];
    return list.filter((o: any) => !['delivered', 'cancelled', 'returned', 'success', 'skipped'].includes(o.status));
  }, [batchOrders, order]);

  const allItems = useMemo(() => {
    const items: any[] = [];
    ordersList.forEach((ord: any) => {
      if (ord.items) {
        ord.items.forEach((item: any, idx: number) => {
          items.push({ ...item, orderId: ord.id, seq: ord.seq || ord.id.slice(-5).toUpperCase(), localIdx: idx });
        });
      }
    });
    return items;
  }, [ordersList]);

  const [checkedItems, setCheckedItems] = useState<any>({});
  const [pickupPhotos, setPickupPhotos] = useState<any>({});
  const [isCompressing, setIsCompressing] = useState<string | null>(null);

  const toggleCheck = useCallback((orderId: string, localIdx: number) => {
    const key = `${orderId}-${localIdx}`;
    setCheckedItems((prev: any) => {
      const newState = { ...prev, [key]: !prev[key] };
      if (onVerificationStatusChange) {
        const allCheckedNow = allItems.every(item => newState[`${item.orderId}-${item.localIdx}`]);
        onVerificationStatusChange(allCheckedNow);
      }
      return newState;
    });
  }, [allItems, onVerificationStatusChange]);

  const handleCapture = useCallback(async (orderId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required');
      return;
    }

    setIsCompressing(orderId);
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
    });

    if (!result.canceled) {
      const newPhotos = { ...pickupPhotos, [orderId]: { file: result.assets[0], previewUrl: result.assets[0].uri } };
      setPickupPhotos(newPhotos);
      if (onPhotosChange) onPhotosChange(newPhotos);
    }
    setIsCompressing(null);
  }, [pickupPhotos, onPhotosChange]);

  const removePhoto = useCallback((orderId: string) => {
    setPickupPhotos((prev: any) => {
      const newPhotos = { ...prev };
      delete newPhotos[orderId];
      if (onPhotosChange) onPhotosChange(newPhotos);
      return newPhotos;
    });
  }, [onPhotosChange]);

  const allChecked = useMemo(() => 
    allItems.length > 0 && allItems.every(item => checkedItems[`${item.orderId}-${item.localIdx}`]),
    [allItems, checkedItems]
  );

  useEffect(() => {
    if (onVerificationStatusChange) onVerificationStatusChange(allChecked);
  }, []);

  const totalBatchAmount = useMemo(() => 
    ordersList.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0),
    [ordersList]
  );

  const isDark = theme === 'dark';
  const cardBg = T.bg;
  const sheetBg = T.hi;
  const txt = T.text;
  const sub = T.sub;
  const brd = T.border;

  return (
    <View style={{ flex: 1, backgroundColor: sheetBg, overflow: 'hidden' }}>
      
      {/* ── FLOATING HEADER CARD ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, zIndex: 20 }}>
        <View style={{
          backgroundColor: cardBg,
          borderWidth: 1, borderColor: brd,
          borderRadius: 22,
          padding: 18,
          overflow: 'hidden',
          flexDirection: 'row', alignItems: 'center', gap: 14,
          shadowColor: '#000', shadowOpacity: isDark ? 0.5 : 0.1, shadowRadius: 28, elevation: 8
        }}>
          <View style={{ position: 'absolute', top: -18, right: -18, opacity: 0.04, transform: [{ rotate: '12deg' }] }}>
            <ClipboardList size={100} color={T.accent} />
          </View>

          <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: `${T.accent}14`, borderWidth: 1, borderColor: `${T.accent}26`, alignItems: 'center', justifyContent: 'center' }}>
            <PackageSearch size={26} color={T.accent} strokeWidth={2} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font, fontSize: 22, letterSpacing: 2, color: T.accent, marginBottom: 3 }}>
              {lang === 'bn' ? 'পণ্য যাচাই করুন' : 'Verify Items'}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: sub }}>
              {lang === 'bn' ? `প্রতিটি পণ্যে ক্লিক করুন (${allItems.length} টি পণ্য)` : `Tap each item to confirm (${allItems.length} items)`}
            </Text>
            {allChecked && (
              <Text style={{ fontSize: 9, fontWeight: '800', color: T.green, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                ✓ {lang === 'bn' ? 'সব যাচাই সম্পন্ন' : 'All Items Verified'}
              </Text>
            )}
          </View>

          <View style={{ backgroundColor: 'rgba(59,130,246,.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,.2)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: font, fontSize: 22, color: T.accent }}>{allItems.length}</Text>
            <Text style={{ fontSize: 7, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: `${T.accent}99` }}>
              {lang === 'bn' ? 'পণ্য' : 'items'}
            </Text>
          </View>
        </View>

        <View style={{ width: 44, height: 5, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.15)', alignSelf: 'center', marginTop: 12, marginBottom: 2 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, paddingTop: 8, gap: 16 }}>
        {ordersList.map((ord: any) => {
          if (!ord.items || ord.items.length === 0) return null;
          return (
            <View key={ord.id} style={{ gap: 10 }}>
              {ordersList.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent }} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: txt, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {lang === 'bn' ? 'অর্ডার #' : 'ORDER #'} {ord.seq || ord.id.slice(-5).toUpperCase()}
                  </Text>
                </View>
              )}

              <ParcelPhoto 
                ord={ord} 
                pickupPhotos={pickupPhotos} 
                isCompressing={isCompressing} 
                handleCapture={handleCapture} 
                removePhoto={removePhoto} 
                T={T} 
                lang={lang} 
                txt={txt} 
                sub={sub} 
              />

              {ord.items.map((item: any, idx: number) => (
                <OrderItem 
                  key={idx}
                  item={item}
                  orderId={ord.id}
                  idx={idx}
                  isChecked={checkedItems[`${ord.id}-${idx}`]}
                  toggleCheck={toggleCheck}
                  T={T}
                  lang={lang}
                  txt={txt}
                  sub={sub}
                  cardBg={cardBg}
                  brd={brd}
                  isDark={isDark}
                />
              ))}
            </View>
          );
        })}

        <View style={{
          backgroundColor: cardBg, borderWidth: 1, borderColor: brd, borderRadius: 18,
          paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 4
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${T.accent}18`, borderWidth: 1, borderColor: `${T.accent}26`, alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={18} color={T.accent} strokeWidth={2} />
            </View>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: sub, marginBottom: 2 }}>
                {lang === 'bn' ? 'মোট বিল' : 'Total Bill'}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: `${T.accent}99` }}>
                {lang === 'bn' ? 'শাখা থেকে নিন' : 'Collect from branch'}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: font, fontSize: 28, letterSpacing: 1, color: txt }}>
            ৳{totalBatchAmount}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

