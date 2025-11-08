import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hthwoidyvazogkkekntu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0aHdvaWR5dmF6b2dra2VrbnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MjExNjcsImV4cCI6MjA3Nzk5NzE2N30.lYf-qeYFC238uhfCWLrre3-eyLKzWSSU-fKHl6317c8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
