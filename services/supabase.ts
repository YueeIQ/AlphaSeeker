import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://d6epf1og91hgk1gnqr50.baseapi.memfiredb.com';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6MzM0ODczNTYyMywiaWF0IjoxNzcxOTM1NjIzLCJpc3MiOiJzdXBhYmFzZSJ9.E7bfFr1ARkCWSkrBte8NLSM1CPSJMhhZhb_zmy-p4YU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
