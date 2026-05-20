import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, STATUS_CONFIG, STORAGE_KEYS } from '../config/constants';

export type Lang = 'bn' | 'en';
export type Theme = 'dark' | 'light';

type ThemeTokens = {
  readonly bg: string; readonly surface: string; readonly surfaceHigh: string;
  readonly border: string; readonly text: string; readonly sub: string;
  readonly hi: string; readonly cardA: string; readonly cardB: string;
  readonly cardC: string; readonly cardD: string; readonly accent: string;
  readonly green: string; readonly danger: string;
};

interface AppContextValue {
  theme: Theme; lang: Lang; T: ThemeTokens; font: string; toastEnabled: boolean;
  toggleTheme: () => void; toggleLang: () => void; toggleToast: () => void;
  t: (key: string) => string;
  getStatus: (status: string) => { label: string; grad: [string, string]; emoji: string } | null;
  showToast?: (title: string, body: string, type?: string | null) => void;
}

const DICT: Record<string, Record<Lang, string>> = {
  login_sub:            { bn: 'রাইডার পোর্টাল', en: 'Rider Portal' },
  login_title:          { bn: 'রাইডার পোর্টাল', en: 'Rider Portal' },
  login_email:          { bn: 'ইমেইল', en: 'Email Address' },
  login_password:       { bn: 'পাসওয়ার্ড', en: 'Password' },
  login_btn:            { bn: 'লগইন করুন', en: 'Sign In' },
  login_loading:        { bn: 'ভেরিফাই হচ্ছে...', en: 'Please wait...' },
  login_terms_label:    { bn: 'আমি শর্তাবলী মেনে নিচ্ছি', en: 'I agree to Terms & Conditions' },
  login_terms_link:     { bn: 'শর্তাবলী', en: 'Terms & Conditions' },
  terms_title:          { bn: 'শর্তাবলী ও গোপনীয়তা নীতি', en: 'Terms & Conditions' },
  terms_scroll_note:    { bn: 'সব পড়ুন তারপর মেনে নিন', en: 'Read all to accept' },
  terms_accept_btn:     { bn: 'মেনে নিলাম', en: 'Accept & Continue' },
  nav_home:             { bn: 'হোম', en: 'Home' },
  nav_orders:           { bn: 'অর্ডার', en: 'Orders' },
  nav_wallet:           { bn: 'ওয়ালেট', en: 'Wallet' },
  nav_alerts:           { bn: 'নোটিফ', en: 'Alerts' },
  nav_profile:          { bn: 'প্রোফাইল', en: 'Profile' },
  status_online:        { bn: 'ডিউটিতে আছি', en: 'On Duty' },
  status_offline:       { bn: 'অফলাইন', en: 'Off Duty' },
  status_delivered:     { bn: 'ডেলিভারড', en: 'Delivered' },
  status_cancelled:     { bn: 'বাতিল', en: 'Cancelled' },
  status_pending:       { bn: 'অপেক্ষমাণ', en: 'Pending' },
  status_active:        { bn: 'সক্রিয়', en: 'Active' },
  you_are_offline:      { bn: 'আপনি অফলাইন', en: "You're Offline" },
  offline_msg:          { bn: 'অর্ডার পেতে ডিউটি চালু করুন', en: 'Start your duty shift to receive orders' },
  go_online:            { bn: 'অনলাইন হন →', en: 'Go Online →' },
  err_offline_active:   { bn: 'চলমান অর্ডার শেষ না করে অফলাইন হওয়া সম্ভব নয়!', en: 'Complete active orders before going offline!' },
  stat_delivered:       { bn: 'আজ ডেলিভারি', en: 'Delivered Today' },
  stat_attendance:      { bn: 'মাসিক হাজিরা', en: 'Attendance' },
  unit_orders:          { bn: 'টি', en: 'orders' },
  unit_days:            { bn: 'দিন', en: 'days' },
  order_queue:          { bn: 'অর্ডার কিউ', en: 'Priority Queue' },
  waiting_orders:       { bn: 'নতুন অর্ডারের জন্য অপেক্ষা করুন', en: 'Waiting for new orders...' },
  resume_delivery:      { bn: 'ডেলিভারি চলছে', en: 'RESUME DELIVERY' },
  wallet_today:         { bn: 'আজকের আয়', en: "Today's Earnings" },
  wallet_in_hand:       { bn: 'হাতে নগদ', en: 'Cash in Hand' },
  orders_title:         { bn: 'আমার কার্যক্রম', en: 'My Activity' },
  orders_header_sub:    { bn: 'কাজের সামারি', en: 'Performance Dashboard' },
  orders_today:         { bn: 'আজকের কাজ', en: 'Today' },
  orders_live:          { bn: 'চলমান অর্ডার', en: 'Live Orders' },
  orders_history:       { bn: 'আগের রেকর্ড', en: 'Past Records' },
  orders_empty:         { bn: 'কোনো রেকর্ড পাওয়া যায়নি', en: 'No Records Found' },
  orders_loading:       { bn: 'তথ্য খোঁজা হচ্ছে...', en: 'Fetching Data…' },
  orders_chat_title:    { bn: 'সক্রিয় চ্যাট', en: 'Active Chats' },
  orders_no_address:    { bn: 'ঠিকানা পাওয়া যায়নি', en: 'No address' },
  flow_assigned:        { bn: 'অর্ডার গ্রহণ করুন', en: 'Accept Order' },
  flow_go_branch:       { bn: 'ব্রাঞ্চে যান', en: 'Go to Branch' },
  flow_accepted:        { bn: 'পিকআপ পয়েন্টে পৌঁছেছি', en: 'Arrived at Branch' },
  flow_at_branch:       { bn: 'পার্সেল বুঝে নিয়েছি', en: 'Parcel Received' },
  flow_picked:          { bn: 'ডেলিভারি শুরু করুন', en: 'Start Journey' },
  flow_out_delivery:    { bn: 'কাস্টমার লোকেশনে পৌঁছেছি', en: 'Arrived at Customer' },
  flow_at_customer:     { bn: 'ডেলিভারি কনফার্ম করুন', en: 'Complete Delivery' },
  flow_delivered:       { bn: 'ড্যাশবোর্ডে ফিরে যান', en: 'Back to Dashboard' },
  flow_waiting:         { bn: 'অপেক্ষা করুন...', en: 'Please wait…' },
  exec_order_label:     { bn: 'অর্ডার আইডি', en: 'Order' },
  exec_mistake:         { bn: 'ভুল হয়েছে?', en: 'Made a mistake?' },
  exec_fix_pickup:      { bn: 'পিকআপ সংশোধন', en: 'Fix Pickup' },
  exec_picked_title:    { bn: 'পণ্য বুঝে নেওয়া হয়েছে', en: 'Product Picked!' },
  exec_picked_sub:      { bn: 'ব্যাগ চেক করে যাত্রা শুরু করুন', en: 'Check bag and start journey' },
  exec_summary:         { bn: 'পিকআপ সামারি', en: 'Picked Summary' },
  exec_syncing:         { bn: 'আপডেট হচ্ছে...', en: 'Syncing with Cloud…' },
  wallet_history:       { bn: 'লেনদেনের ইতিহাস', en: 'Transaction History' },
  wallet_cash_label:    { bn: 'নগদ সংগ্রহ', en: 'Cash Collection' },
  wallet_admin_label:   { bn: 'এডমিন ট্রান্সফার', en: 'Admin Transfer' },
  wallet_transfer_btn:  { bn: 'ক্যাশ ট্রান্সফার', en: 'Transfer Cash' },
  wallet_tab_all:       { bn: 'সব', en: 'All' },
  wallet_tab_cash:      { bn: 'নগদ', en: 'Cash' },
  wallet_tab_transfer:  { bn: 'ট্রান্সফার', en: 'Transfer' },
  wallet_empty:         { bn: 'কোনো লেনদেন নেই', en: 'No transactions yet' },
  wallet_note:          { bn: 'অনুগ্রহ করে এডমিনকে ক্যাশ জমা দিন', en: 'Please submit cash to admin' },
  wallet_order_prefix:  { bn: 'অর্ডার', en: 'Order' },
  wallet_balance_transfer: { bn: 'ব্যালেন্স ট্রান্সফার', en: 'Balance Transfer' },
  wallet_credit_tag:    { bn: 'ক্রেডিট', en: 'CREDIT' },
  wallet_transfer_tag:  { bn: 'ডেবিট', en: 'DEBIT' },
  wallet_done:          { bn: 'সম্পন্ন', en: 'Done' },
  wallet_title:         { bn: 'আমার ওয়ালেট', en: 'My Wallet' },
  wallet_sub:           { bn: 'আয় ও লেনদেনের হিসাব', en: 'Earnings & Activity' },
  wallet_total_cash:    { bn: 'মোট নগদ', en: 'Total Cash' },
  wallet_collections:   { bn: 'মোট পার্সেল', en: 'Total Parcels' },
  wallet_transferred:   { bn: 'মোট ট্রান্সফার', en: 'Total Transferred' },
  wallet_items:         { bn: 'টি', en: 'items' },
  wallet_empty_sub:     { bn: 'এখনো কোনো লেনদেনের তথ্য পাওয়া যায়নি', en: 'No history found' },
  wallet_tx_label:      { bn: 'লেনদেন', en: 'Transaction' },
  wallet_pending:       { bn: 'পেন্ডিং', en: 'Pending' },
  notif_title:          { bn: 'নোটিফিকেশন', en: 'Notifications' },
  notif_tab_all:        { bn: 'সব', en: 'All' },
  notif_tab_chat:       { bn: 'চ্যাট', en: 'Chat' },
  notif_tab_orders:     { bn: 'অর্ডার', en: 'Orders' },
  notif_tab_wallet:     { bn: 'ওয়ালেট', en: 'Wallet' },
  notif_empty:          { bn: 'কোনো নোটিফিকেশন নেই', en: 'No notifications yet' },
  notif_empty_sub:      { bn: 'নতুন অর্ডার বা মেসেজ পেলে এখানে দেখাবে', en: 'New orders and messages will appear here' },
  notif_just_now:       { bn: 'এইমাত্র', en: 'Just now' },
  notif_min_ago:        { bn: 'মিনিট আগে', en: 'm ago' },
  notif_hr_ago:         { bn: 'ঘণ্টা আগে', en: 'h ago' },
  notif_day_ago:        { bn: 'দিন আগে', en: 'd ago' },
  notif_unread:         { bn: '{{n}}টি অপঠিত বার্তা', en: '{{n}} unread' },
  notif_all_read:       { bn: 'সব পড়া হয়েছে', en: 'All caught up' },
  notif_read_all:       { bn: 'পড়া হয়েছে', en: 'Read all' },
  notif_clear:          { bn: 'মুছুন', en: 'Clear' },
  notif_open:           { bn: 'খুলুন', en: 'Open' },
  notif_tab_cash:       { bn: 'নগদ জমা', en: 'Cash' },
  notif_tab_transfer:   { bn: 'ট্রান্সফার', en: 'Transfer' },
  nstatus_assigned:     { bn: 'নতুন অর্ডার অ্যাসাইন হয়েছে', en: 'New Order Assigned' },
  nstatus_accepted:     { bn: 'অর্ডার গ্রহণ করা হয়েছে', en: 'Order Accepted' },
  nstatus_go_to_branch: { bn: 'ব্রাঞ্চে যাচ্ছেন', en: 'Going to Branch' },
  nstatus_arrived_at_branch: { bn: 'ব্রাঞ্চে পৌঁছেছেন', en: 'Arrived at Branch' },
  nstatus_picked:       { bn: 'পার্সেল পিক করা হয়েছে', en: 'Parcel Picked Up' },
  nstatus_out_for_delivery: { bn: 'ডেলিভারিতে বের হয়েছেন', en: 'Out for Delivery' },
  nstatus_arrived_at_customer: { bn: 'কাস্টমারের কাছে পৌঁছেছেন', en: 'Arrived at Customer' },
  nstatus_delivered:    { bn: 'ডেলিভারি সম্পন্ন হয়েছে', en: 'Delivery Completed' },
  nstatus_cancelled:    { bn: 'অর্ডার বাতিল হয়েছে', en: 'Order Cancelled' },
  nstatus_returning_to_branch: { bn: 'অর্ডারটি ব্রাঞ্চে ফেরত যাচ্ছে', en: 'Returning to Branch' },
  notif_order_body_bn:  { bn: 'অর্ডার', en: 'Order' },
  notif_msg_from:       { bn: 'মেসেজ পাঠিয়েছেন', en: 'Message from' },
  notif_wallet_added:   { bn: 'ওয়ালেটে জমা হয়েছে', en: 'added to wallet' },
  notif_wallet_sent:    { bn: 'অ্যাডমিনকে পাঠানো হয়েছে', en: 'sent to admin' },
  notif_cash_from:      { bn: 'থেকে ক্যাশ কালেকশন', en: 'Cash from Order' },
  notif_transfer_done:  { bn: 'ব্যালেন্স ট্রান্সফার সম্পন্ন হয়েছে', en: 'Balance transfer completed' },
  notif_tag_credit:     { bn: 'জমা', en: 'Credit' },
  notif_tag_transfer:   { bn: 'ট্রান্সফার', en: 'Transfer' },
  toast_accepted:       { bn: 'অর্ডার গ্রহণ করা হয়েছে', en: 'Order Accepted' },
  toast_arrived_branch: { bn: 'ব্রাঞ্চে পৌঁছেছেন', en: 'Arrived at Branch' },
  toast_picked:         { bn: 'পার্সেল পিক করা হয়েছে', en: 'Parcel Picked Up' },
  toast_trip_started:   { bn: 'ডেলিভারি ট্রিপ শুরু হয়েছে', en: 'Journey Started' },
  toast_arrived_customer: { bn: 'কাস্টমার লোকেশনে পৌঁছেছেন', en: 'Arrived at Customer' },
  toast_cancelled:      { bn: 'অর্ডার বাতিল করা হয়েছে', en: 'Order Cancelled' },
  toast_delivered:      { bn: 'ডেলিভারি সফল হয়েছে', en: 'Delivery Successful' },
  profile_title:        { bn: 'আমার প্রোফাইল', en: 'Profile' },
  profile_id:           { bn: 'আইডি নম্বর', en: 'ID' },
  profile_certified:    { bn: 'ভেরিফাইড রাইডার', en: 'Certified Rider' },
  profile_duty_label:   { bn: 'ডিউটি স্ট্যাটাস', en: 'Duty Status' },
  profile_shift_on:     { bn: 'ডিউটি চালু', en: 'Shift Active' },
  profile_shift_off:    { bn: 'ডিউটি বন্ধ', en: 'Shift Inactive' },
  profile_stats_title:  { bn: 'পারফরম্যান্স', en: 'Performance' },
  profile_total_orders: { bn: 'মোট ডেলিভারি', en: 'Total Deliveries' },
  profile_stats_today:  { bn: 'আজকের ডেলিভারি', en: "Today's Deliveries" },
  profile_holding_cash: { bn: 'হাতে নগদ', en: 'Cash in Hand' },
  profile_account_title:{ bn: 'অ্যাকাউন্ট তথ্য', en: 'Account Info' },
  profile_phone:        { bn: 'ফোন নম্বর', en: 'Contact Phone' },
  profile_email:        { bn: 'রেজিস্ট্রেশন ইমেইল', en: 'Registry Email' },
  profile_location:     { bn: 'বর্তমান অবস্থান', en: 'Last Known Location' },
  profile_gps_wait:     { bn: 'সিগন্যালের অপেক্ষা...', en: 'Wait for GPS…' },
  profile_gps_on:       { bn: 'জিপিএস কানেক্টেড', en: 'GPS Signal On' },
  profile_gps_off:      { bn: 'জিপিএস অফ', en: 'GPS Dormant' },
  profile_settings_title: { bn: 'সেটিংস', en: 'Settings' },
  profile_toast_notif:  { bn: 'ইন-অ্যাপ নোটিফিকেশন', en: 'In-App Notifications' },
  profile_visible:      { bn: 'অনলাইন', en: 'Visible' },
  profile_invisible:    { bn: 'অফলাইন', en: 'Invisible' },
  profile_visibility:   { bn: 'প্রোফাইল ভিজিবিলিটি', en: 'Profile Visibility' },
  profile_tracking:     { bn: 'লাইভ ট্র্যাকিং', en: 'Live Tracking' },
  profile_history:      { bn: 'পুরানো রুট ম্যাপ', en: 'View History Map' },
  profile_log_label:    { bn: 'অ্যাক্টিভিটি লগ', en: 'Movement & Shift Logs' },
  profile_not_set:      { bn: 'যুক্ত নেই', en: 'Not Set' },
  profile_logout:       { bn: 'লগ আউট করুন', en: 'Deactivate Session' },
  profile_certified_tag:{ bn: 'অফিসিয়াল রাইডার', en: 'Official Rider' },
  profile_join_date:    { bn: 'যোগদানের তারিখ', en: 'Joined Since' },
  profile_acc_status:   { bn: 'অ্যাকাউন্ট স্ট্যাটাস', en: 'Account Status' },
  profile_verified:     { bn: 'ভেরিফাইড', en: 'Verified' },
  profile_level_up:     { bn: 'প্রতি ১০০ ডেলিভারিতে লেভেল বাড়ে', en: 'Level up every 100 deliveries' },
  profile_rank_title:   { bn: 'রাইডার লেভেল', en: 'Experience Level' },
  profile_stat_avg:     { bn: 'গড় রেটিং', en: 'Avg Rating' },
  profile_stat_cash:    { bn: 'নগদ জমা', en: 'Cash' },
  profile_stat_today:   { bn: 'আজকের', en: 'Today' },
  profile_stat_total:   { bn: 'মোট', en: 'Total' },
  profile_help_title:   { bn: 'সহায়তা ও সাপোর্ট', en: 'Help & Support' },
  profile_contact_support:{ bn: 'সাপোর্টে যোগাযোগ', en: 'Contact Support' },
  profile_privacy_policy:{ bn: 'গোপনীয়তা নীতি', en: 'Privacy Policy' },
  profile_terms_service: { bn: 'ব্যবহারের শর্তাবলী', en: 'Terms of Service' },
  attend_title:         { bn: 'পারফরম্যান্স', en: 'Performance' },
  attend_live_route:    { bn: 'লাইভ রুট', en: 'Live Route' },
  attend_workload:      { bn: 'কাজের চাপ', en: 'Workload' },
  attend_logged:        { bn: 'মোট সময়', en: 'h Logged' },
  attend_shift_live:    { bn: 'শিফট চালু আছে', en: 'Shift is Live' },
  attend_offline:       { bn: 'অফলাইন মোড', en: 'Offline Mode' },
  attend_finish:        { bn: 'শিফট শেষ করুন', en: 'Finish Shift' },
  attend_start:         { bn: 'শিফট শুরু করুন', en: 'Start Shift' },
  attend_recent:        { bn: 'সাম্প্রতিক লগ', en: 'Recent Logs' },
  attend_minutes:       { bn: 'মিনিট', en: 'Minutes' },
  dc_confirm_for:       { bn: 'ডেলিভারি নিশ্চিতকরণ', en: 'Confirmation For' },
  dc_collect:           { bn: 'ক্যাশ কালেকশন', en: 'Collect Cash' },
  dc_cash_sub:          { bn: 'কাস্টমারের থেকে টাকা নিন', en: 'Collect cash from customer' },
  dc_cash_btn:          { bn: 'টাকা পেয়েছি', en: 'Confirm Cash Received' },
  dc_photo_sub:         { bn: 'প্রুফ হিসেবে ছবি দিন', en: 'Delivery Proof Photo' },
  dc_photo_tap:         { bn: 'ক্যামেরা আইকনে ট্যাপ করুন', en: 'Tap to Capture' },
  dc_next:              { bn: 'পরবর্তী ধাপ', en: 'Next Step' },
  dc_verify:            { bn: 'ভেরিফাই ও সম্পন্ন', en: 'Verify & Complete' },
  dc_resend:            { bn: 'আবার কোড পাঠান', en: 'Resend OTP' },
  dc_complete_btn:      { bn: 'ডেলিভারি সম্পন্ন করুন', en: 'Complete Delivery' },
  dc_processing:        { bn: 'প্রসেস হচ্ছে...', en: 'Processing…' },
  dc_cancel:            { bn: 'বাতিল করুন', en: 'Cancel' },
  dc_delivered:         { bn: 'ডেলিভারড!', en: 'Delivered!' },
  dc_great_job:         { bn: 'দুর্দান্ত কাজ, রাইডার!', en: 'Great Job, Rider!' },
  dc_err_wrong_otp:     { bn: 'ভুল ওটিপি! আবার চেষ্টা করুন।', en: 'Wrong OTP! Try again.' },
  dc_err_upload:        { bn: 'আপলোড হয়নি, ইন্টারনেট চেক করুন।', en: 'Upload failed! Check internet.' },
  dc_err_img:           { bn: 'ছবি প্রসেস করা যাচ্ছে না', en: 'Image processing failed!' },
  dc_err_resend:        { bn: 'ওটিপি পাঠানো যায়নি', en: 'OTP resend failed' },
  odm_title:            { bn: 'অর্ডারের বিবরণ', en: 'Order Details' },
  odm_payment:          { bn: 'পেমেন্ট স্ট্যাটাস', en: 'Payment Status' },
  odm_otp:              { bn: 'সিকিউরিটি ওটিপি', en: 'Security OTP' },
  odm_recipient:        { bn: 'প্রাপকের তথ্য', en: 'Recipient Details' },
  odm_items:            { bn: 'পণ্যের তালিকা', en: 'Order Items' },
  odm_total:            { bn: 'সর্বমোট', en: 'Grand Total' },
  odm_timeline:         { bn: 'ট্র্যাকিং টাইমলাইন', en: 'Tracking Timeline' },
  odm_proof:            { bn: 'ডেলিভারি প্রুফ যাচাই', en: 'Delivery Proof Verified' },
  odm_tl_created:       { bn: 'অর্ডার তৈরি হয়েছে', en: 'Created' },
  odm_tl_accepted:      { bn: 'অর্ডার গ্রহণ করা হয়েছে', en: 'Accepted' },
  odm_tl_branch:        { bn: 'ব্রাঞ্চে পৌঁছেছে', en: 'At Branch' },
  odm_tl_picked:        { bn: 'পিকড আপ', en: 'Picked Up' },
  odm_tl_onway:         { bn: 'পথে আছে', en: 'On The Way' },
  odm_tl_delivered:     { bn: 'ডেলিভারি সম্পন্ন', en: 'Delivered' },
  popup_new:            { bn: 'নতুন অর্ডার এসাইন হয়েছে', en: 'New Order Assigned' },
  popup_pickup:         { bn: 'পিকআপ লোকেশন', en: 'Pickup Location' },
  popup_skip:           { bn: 'পরে করুন', en: 'Skip' },
  popup_accept:         { bn: 'অর্ডারটি নিন', en: 'Accept' },
  order_popup_title:    { bn: 'নতুন অর্ডার!', en: 'New Order!' },
  order_popup_accept:   { bn: 'গ্রহণ করুন', en: 'Accept' },
  order_popup_decline:  { bn: 'প্রত্যাখ্যান করুন', en: 'Decline' },
  aoc_active:           { bn: 'চলমান অর্ডার', en: 'Active Order' },
  aoc_details:          { bn: 'ডিটেইলস দেখুন', en: 'View Order Details' },
  chat_title:           { bn: 'কাস্টমার চ্যাট', en: 'Customer Chat' },
  chat_placeholder:     { bn: 'মেসেজ লিখুন...', en: 'Type a message...' },
  chat_typing:          { bn: 'লিখছে...', en: 'Typing' },
  chatlist_search:      { bn: 'কাস্টমার বা অর্ডার খুঁজুন...', en: 'Search customer or order ID...' },
  chatlist_loading:     { bn: 'চ্যাট লোড হচ্ছে...', en: 'Loading Chats…' },
  chatlist_empty:       { bn: 'কোনো চ্যাট হিস্ট্রি নেই', en: 'No active chats' },
  cancel_title:         { bn: 'অর্ডার বাতিল', en: 'Cancel Order' },
  cancel_reason_label:  { bn: 'বাতিলের কারণ', en: 'Cancellation Reason' },
  cancel_btn:           { bn: 'বাতিল করুন', en: 'Cancel Order' },
  return_title:         { bn: 'অর্ডার ফেরত', en: 'Return Order' },
  return_reason_label:  { bn: 'ফেরতের কারণ', en: 'Return Reason' },
  return_btn:           { bn: 'ফেরত দিন', en: 'Return Order' },
  back:                 { bn: 'পেছনে', en: 'Back' },
  cancel:               { bn: 'বাতিল', en: 'Cancel' },
  confirm:              { bn: 'নিশ্চিত করুন', en: 'Confirm' },
  loading:              { bn: 'লোড হচ্ছে...', en: 'Loading...' },
  next:                 { bn: 'পরবর্তী', en: 'Next' },
  complete:             { bn: 'সম্পন্ন করুন', en: 'Complete' },
  verify_otp:           { bn: 'ওটিপি যাচাই', en: 'Verify OTP' },
  collect_cash:         { bn: 'পেমেন্ট সংগ্রহ', en: 'Confirm Cash Received' },
  take_photo:           { bn: 'ছবি তুলুন', en: 'Take Photo' },
  resend_otp:           { bn: 'ওটিপি পাননি?', en: 'Resend OTP' },
  dark_mode:            { bn: 'ডার্ক মোড', en: 'Dark Mode' },
  light_mode:           { bn: 'লাইট মোড', en: 'Light Mode' },
  lang_bn:              { bn: 'বাংলা', en: 'Bengali' },
  lang_en:              { bn: 'English', en: 'English' },
  no_internet:          { bn: 'ইন্টারনেট সংযোগ নেই', en: 'No Internet Connection' },
  no_internet_sub:      { bn: 'ইন্টারনেট চেক করে আবার চেষ্টা করুন', en: 'Check your connection and try again' },
  btn_loading:          { bn: 'অপেক্ষা করুন...', en: 'Please wait…' },
  home_on_break:        { bn: 'বিশ্রামে আছেন', en: "You're on Break" },
  home_duty_off_msg:    { bn: 'আপনার ডিউটি এখন বন্ধ। নতুন অর্ডার ডেলিভারি করতে ডিউটি অন করুন।', en: 'Your duty is currently off. Toggle back online to start delivering new orders.' },
  home_start_shift:     { bn: 'ডিউটি শুরু করুন', en: 'Start My Shift' },
  home_cash_in_hand:    { bn: 'হাতে ক্যাশ', en: 'Cash in Hand' },
  home_total_delivery:  { bn: 'মোট ডেলিভারি', en: 'Total Deliveries' },
  home_rating:          { bn: 'রেটিং', en: 'Rating' },
  home_map:             { bn: 'ম্যাপ', en: 'Map' },
  home_list:            { bn: 'লিস্ট', en: 'List' },
  home_order_warning:   { bn: 'অর্ডার সতর্কতা!', en: 'ORDER WARNING!' },
  home_active_warning:  { bn: 'আপনার ফোনে এখনও একটি সক্রিয় অর্ডার রয়েছে। অফলাইন যাওয়ার আগে অনুগ্রহ করে তা শেষ করুন।', en: 'You still have an active order. Please complete it before going offline.' },
  home_ok:              { bn: 'ঠিক আছে', en: 'OK, GOT IT' },
  home_today_deliv:     { bn: 'আজকের ডেলিভারি', en: "Today's Delivery" },
  home_deliv_history:   { bn: 'ডেলিভারি হিস্ট্রি', en: 'Delivery History' },
  home_no_data:         { bn: 'কোনো ডাটা পাওয়া যায়নি', en: 'No data found' },
  home_rider_reviews:   { bn: 'রাইডার রিভিউ', en: 'Rider Reviews' },
  home_total_reviews:   { bn: 'টি রিভিউ পাওয়া গেছে', en: 'Total Reviews' },
  home_avg_rating:      { bn: 'গড় রেটিং', en: 'Avg Rating' },
  home_feedback_sub:    { bn: 'সব কাস্টমার ফিডব্যাক', en: 'Based on all customer feedback' },
  home_no_reviews:      { bn: 'কোনো রিভিউ পাওয়া যায়নি', en: 'No reviews yet' },
  home_batch_label:     { bn: 'অর্ডারের ব্যাচ', en: 'Order Batch' },
  home_multiple_dest:   { bn: 'একাধিক গন্তব্য', en: 'Multiple Drops' },
  home_total_items:     { bn: 'টি আইটেম', en: 'items' },
  new_order:            { bn: 'নতুন অর্ডার পাওয়া গেছে', en: 'New Order Assigned' },
  accept:               { bn: 'অর্ডার নিন', en: 'Accept' },
  skip:                 { bn: 'এড়িয়ে যান', en: 'Skip' },
};

const AppContext = createContext<AppContextValue>({
  T: COLORS.dark, t: (k: string) => k, lang: 'bn', font: 'Nunito_600SemiBold',
  theme: 'dark', toastEnabled: true,
  toggleTheme: () => {}, toggleLang: () => {}, toggleToast: () => {}, getStatus: () => null,
} as AppContextValue);

export function AppProvider({ children, globalToast }: { children: ReactNode; globalToast?: (title: string, body: string, type?: string | null) => void; }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Lang>('bn');
  const [toastEnabled, setToastEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedTheme, savedLang, savedToast] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.theme),
        AsyncStorage.getItem(STORAGE_KEYS.lang),
        AsyncStorage.getItem(STORAGE_KEYS.toastEnabled),
      ]);
      if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
      if (savedLang === 'bn' || savedLang === 'en') setLang(savedLang);
      if (savedToast !== null) setToastEnabled(savedToast === 'true');
      setReady(true);
    })();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => { const next = prev === 'dark' ? 'light' : 'dark'; AsyncStorage.setItem(STORAGE_KEYS.theme, next); return next; });
  }, []);

  const toggleLang = useCallback(() => {
    setLang(prev => { const next = prev === 'bn' ? 'en' : 'bn'; AsyncStorage.setItem(STORAGE_KEYS.lang, next); return next; });
  }, []);

  const toggleToast = useCallback(() => {
    setToastEnabled(prev => { AsyncStorage.setItem(STORAGE_KEYS.toastEnabled, String(!prev)); return !prev; });
  }, []);

  const t = useCallback((key: string): string => DICT[key]?.[lang] ?? key, [lang]);

  const getStatus = useCallback((status: string) => {
    const cfg = STATUS_CONFIG[status];
    if (!cfg) return null;
    return { label: lang === 'bn' ? cfg.labelBn : cfg.labelEn, grad: cfg.grad, emoji: cfg.emoji };
  }, [lang]);

  const T = useMemo(() => (theme === 'dark' ? COLORS.dark : COLORS.light), [theme]);
  const font = useMemo(() => (lang === 'bn' ? 'HindSiliguri_400Regular' : 'Nunito_400Regular'), [lang]);

  const value = useMemo(() => ({
    theme, lang, T, font, toastEnabled,
    toggleTheme, toggleLang, toggleToast, t, getStatus,
    showToast: globalToast
  }), [theme, lang, T, font, toastEnabled, toggleTheme, toggleLang, toggleToast, t, getStatus, globalToast]);

  if (!ready) return null;

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue { return useContext(AppContext); }