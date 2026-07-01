import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { CheckCircle2, PackageSearch, ShoppingBag, ClipboardList, Check, Banknote, Camera, RotateCcw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../../context/AppContext';

const BatchPhoto = React.memo(({ batchPhoto, isCompressing, handleCapture, removePhoto, T, lang, txt, sub }: any) => {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, opacity: 0.8 }}>
        <Camera size={12} color={T.accent} />
        <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.accent }}>
          {lang === 'bn' ? 'পার্সেল বা রসিদের ছবি (বাধ্যতামূলক)' : 'Parcel or Receipt Photo (Required)'}
        </Text>
      </View>

      <Pressable
        onPress={() => !batchPhoto && handleCapture()}
        style={{
          width: '100%',
          height: batchPhoto ? 200 : 90,
          borderRadius: 20,
          backgroundColor: batchPhoto ? T.surface : `${T.accent}05`,
          borderWidth: 1.5,
          borderColor: batchPhoto ? T.green : isCompressing ? T.accent : `${T.accent}25`,
          borderStyle: batchPhoto ? 'solid' : 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: batchPhoto ? T.green : T.accent,
          shadowOpacity: batchPhoto ? 0.05 : 0,
          shadowRadius: 10,
          elevation: 2
        }}
      >
        {isCompressing ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: T.accent }}>{lang === 'bn' ? 'প্রসেসিং হচ্ছে...' : 'Processing...'}</Text>
          </View>
        ) : batchPhoto ? (
          <>
            <Image source={{ uri: batchPhoto.previewUrl }} style={{ width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 }}>
              <CheckCircle2 size={16} color="#10b981" strokeWidth={3} />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>{lang === 'bn' ? 'ছবি নেওয়া হয়েছে' : 'PHOTO ATTACHED'}</Text>
            </View>
            <Pressable
              onPress={removePhoto}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(239,68,68,0.95)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 5,
                elevation: 4
              }}
            >
              <RotateCcw size={16} color="#fff" strokeWidth={3} />
            </Pressable>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 }}>
            <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: `${T.accent}12`, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={22} color={T.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: txt, letterSpacing: 0.5 }}>{lang === 'bn' ? 'ক্যামেরা খুলতে এখানে চাপুন' : 'TAP TO OPEN CAMERA'}</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: sub, marginTop: 2 }}>{lang === 'bn' ? 'পার্সেল বা রসিদ সমূহের একটি স্পষ্ট ছবি তুলুন' : 'Capture a clear photo of the parcels or receipt'}</Text>
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
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: isChecked ? (isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)') : cardBg,
        borderWidth: 1,
        borderColor: isChecked ? '#10b981' : brd,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: isChecked ? '#10b981' : '#000',
        shadowOpacity: isChecked ? 0.04 : 0.01,
        shadowRadius: 8,
        elevation: 1
      }}
    >
      {isChecked && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#10b981' }} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isChecked ? 'rgba(16,185,129,0.2)' : brd,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: T.hi
        }}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', opacity: isChecked ? 1 : 0.75 }} />
          ) : (
            <ShoppingBag size={24} color={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'} strokeWidth={1.5} />
          )}
          <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: isChecked ? '#10b981' : T.accent, paddingVertical: 1.5, paddingHorizontal: 5, borderBottomLeftRadius: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>x{item.qty || item.quantity}</Text>
          </View>
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: isChecked ? '#10b981' : txt, marginBottom: 4 }} numberOfLines={1}>
            {lang === 'bn' ? (item.name_bn || item.name_en || item.name) : (item.name_en || item.name_bn || item.name)}
          </Text>
          {!item.selectedVariation && (
            <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: sub }}>
              {lang === 'bn' ? (item.unit_bn || item.unit_en || 'ইউনিট') : (item.unit_en || item.unit_bn || 'Unit')}
            </Text>
          )}
          {item.selectedVariation && (
            <View style={{ backgroundColor: isChecked ? 'rgba(16,185,129,0.12)' : `${T.accent}12`, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: isChecked ? '#10b981' : T.accent }}>
                {lang === 'bn' ? item.selectedVariation.label_bn : item.selectedVariation.label_en}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isChecked ? '#10b981' : 'transparent',
        borderWidth: 1.5,
        borderColor: isChecked ? '#10b981' : brd,
      }}>
        {isChecked ? (
          <Check size={16} color="#fff" strokeWidth={3} />
        ) : null}
      </View>
    </Pressable>
  );
});

export default function ArrivedAtBranchView({ order, batchOrders, onPhotosChange, checkedItems, onCheckedItemsChange, batchPhoto, onBatchPhotoChange }: any) {
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
          items.push({ ...item, orderId: ord.id, seq: ord.id, localIdx: idx });
        });
      }
    });
    return items;
  }, [ordersList]);

  const toggleCheck = useCallback((orderId: string, localIdx: number) => {
    const key = `${orderId}-${localIdx}`;
    onCheckedItemsChange((prev: any) => ({ ...prev, [key]: !prev[key] }));
  }, [onCheckedItemsChange]);

  const [isCompressing, setIsCompressing] = useState(false);

  const handleCapture = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { alert('Camera permission is required'); return; }
      setIsCompressing(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
      });
      if (!result.canceled && result.assets?.[0]) {
        const photo = { file: result.assets[0], previewUrl: result.assets[0].uri };
        onBatchPhotoChange(photo);
        if (onPhotosChange) {
          const mapped: any = {};
          ordersList.forEach((o: any) => { mapped[o.id] = photo; });
          onPhotosChange(mapped);
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
    } finally {
      setIsCompressing(false);
    }
  }, [ordersList, onPhotosChange, onBatchPhotoChange]);

  const removePhoto = useCallback(() => {
    onBatchPhotoChange(null);
    if (onPhotosChange) onPhotosChange({});
  }, [onPhotosChange, onBatchPhotoChange]);

  const allChecked = useMemo(() =>
    allItems.length > 0 && allItems.every(item => checkedItems[`${item.orderId}-${item.localIdx}`]),
    [allItems, checkedItems]
  );

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
          borderWidth: 1,
          borderColor: brd,
          borderRadius: 24,
          padding: 20,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 24,
          elevation: 8
        }}>
          <View style={{ position: 'absolute', top: -18, right: -18, opacity: 0.03, transform: [{ rotate: '12deg' }] }}>
            <ClipboardList size={100} color={T.accent} />
          </View>

          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: `${T.accent}12`, borderWidth: 1.5, borderColor: `${T.accent}25`, alignItems: 'center', justifyContent: 'center' }}>
            <PackageSearch size={26} color={T.accent} strokeWidth={2} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font, fontSize: 22, fontWeight: '900', letterSpacing: 0.5, color: T.accent, marginBottom: 4 }}>
              {lang === 'bn' ? 'পণ্য যাচাই করুন' : 'Verify Items'}
            </Text>
            <Text style={{ fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: sub }}>
              {lang === 'bn' ? `প্রতিটি পণ্যে ট্যাপ করে কনফার্ম করুন` : `Tap each item to confirm`}
            </Text>
            {allChecked && (
              <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#10b981', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                ✓ {lang === 'bn' ? 'সব যাচাই সম্পন্ন' : 'All Items Verified'}
              </Text>
            )}
          </View>

          <View style={{ backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}25`, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font, fontSize: 20, fontWeight: '900', color: T.accent }}>{allItems.length}</Text>
            <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: sub }}>
              {lang === 'bn' ? 'আইটেম' : 'items'}
            </Text>
          </View>
        </View>

        <View style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', alignSelf: 'center', marginTop: 12, marginBottom: 2 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, paddingTop: 10, gap: 18 }} showsVerticalScrollIndicator={false}>

        {/* Single batch photo */}
        <BatchPhoto
          batchPhoto={batchPhoto}
          isCompressing={isCompressing}
          handleCapture={handleCapture}
          removePhoto={removePhoto}
          T={T}
          lang={lang}
          txt={txt}
          sub={sub}
        />

        {ordersList.map((ord: any) => {
          if (!ord.items || ord.items.length === 0) return null;
          return (
            <View key={ord.id} style={{ gap: 12 }}>
              {ordersList.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4, marginTop: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.accent }} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: txt, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {lang === 'bn' ? 'অর্ডার #' : 'ORDER #'} {ord.id}
                  </Text>
                </View>
              )}

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
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: brd,
          borderRadius: 20,
          paddingVertical: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.2 : 0.02,
          shadowRadius: 10,
          elevation: 2
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={20} color={T.accent} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: sub, marginBottom: 3 }}>
                {lang === 'bn' ? 'মোট বিল' : 'Total Bill'}
              </Text>
              <Text style={{ fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: T.accent }}>
                {lang === 'bn' ? 'শাখা থেকে সংগ্রহ করুন' : 'Collect from branch'}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: font, fontSize: 30, fontWeight: '900', letterSpacing: 0.5, color: txt }}>
            ৳{totalBatchAmount.toLocaleString()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

