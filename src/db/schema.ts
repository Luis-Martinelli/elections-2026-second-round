import { boolean, doublePrecision, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table (required for Firebase Auth integration)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Check-ins table (high-concurrency write target during election hours)
export const checkins = pgTable('checkins', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  schoolName: text('school_name').notNull(),
  city: text('city').notNull(),
  officerRe: text('officer_re').notNull(),
  officerName: text('officer_name').notNull(),
  rank: text('rank').notNull(),
  shift: text('shift').notNull(),
  time: text('time').notNull(),
  timestamp: doublePrecision('timestamp').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  accuracy: doublePrecision('accuracy'),
  distanceMeters: doublePrecision('distance_meters'),
  isOutOfRange: boolean('is_out_of_range').default(false).notNull(),
  protocol: text('protocol').notNull(),
  syncedToSheets: boolean('synced_to_sheets').default(false),
  isValidated: boolean('is_validated').default(false),
  validatedBy: text('validated_by'),
  validatedAt: text('validated_at'),
  validatedTimestamp: doublePrecision('validated_timestamp'),
  auditNotes: text('audit_notes'),
  auditStatus: text('audit_status'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Rondas table
export const rondas = pgTable('rondas', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  schoolName: text('school_name').notNull(),
  city: text('city').notNull(),
  officerRe: text('officer_re').notNull(),
  officerName: text('officer_name').notNull(),
  rank: text('rank').notNull(),
  situation: text('situation').notNull(),
  obs: text('obs'),
  time: text('time').notNull(),
  timestamp: doublePrecision('timestamp').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  shift: text('shift'),
  syncedToSheets: boolean('synced_to_sheets').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Schools table (Polling stations and assigned officers)
export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  zone: text('zone').notNull(),
  school: text('school').notNull(),
  bairro: text('bairro'),
  city: text('city').notNull(),
  opm: text('opm'),
  amJson: jsonb('am_json'),
  pmJson: jsonb('pm_json'),
  amOfficersJson: jsonb('am_officers_json'),
  pmOfficersJson: jsonb('pm_officers_json'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  address: text('address'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Staff table (Police officers roster)
export const staff = pgTable('staff', {
  re: text('re').primaryKey(),
  name: text('name').notNull(),
  rank: text('rank'),
  unit: text('unit'),
  phone: text('phone'),
  local: text('local'),
  function: text('function'),
  shiftRaw: text('shift_raw'),
  vehicle: text('vehicle'),
  driver: text('driver'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Device bindings table (Security binding per device)
export const deviceBindings = pgTable('device_bindings', {
  deviceId: text('device_id').primaryKey(),
  boundRe: text('bound_re').notNull(),
  boundName: text('bound_name').notNull(),
  boundRank: text('bound_rank').notNull(),
  boundEmail: text('bound_email'),
  boundAt: text('bound_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit justification logs table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: doublePrecision('timestamp').notNull(),
  dateTimeStr: text('date_time_str').notNull(),
  deviceId: text('device_id').notNull(),
  userEmail: text('user_email'),
  originRe: text('origin_re').notNull(),
  originName: text('origin_name').notNull(),
  targetRe: text('target_re').notNull(),
  targetName: text('target_name').notNull(),
  justification: text('justification').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// System configuration table (Settings, sync status, etc.)
export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(),
  configJson: jsonb('config_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
