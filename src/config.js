(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Supabase connection for the global scoreboard.
  // The anon/public key is meant to be embedded in client apps — it is safe to
  // ship and commit. Row Level Security on the `scores` table is what protects
  // the data. NEVER put the service_role key here.
  ns.config = {
    supabaseUrl: 'https://hnftwdrnoyxhwrxkunep.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZnR3ZHJub3l4aHdyeGt1bmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTExMDYsImV4cCI6MjA5Nzg4NzEwNn0.WmWytH5wstZsDfix-ErUD0mwBE-uDZqddyEx_L59h-w'
    // New-style publishable key also works as `apikey` if you migrate:
    // 'sb_publishable_EX4S2CPCzaocnjD1LDuItg_dZwTsOI0'
  };
})();
