Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Generate secure room ID using Web Crypto API
    const roomId = crypto.randomUUID();
    
    // Set expiration to 6 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    // Create room record
    const createRoomResponse = await fetch(`${supabaseUrl}/rest/v1/consultation_rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        room_id: roomId,
        expires_at: expiresAt.toISOString(),
        status: 'waiting'
      })
    });

    if (!createRoomResponse.ok) {
      const errorText = await createRoomResponse.text();
      throw new Error(`Failed to create room: ${errorText}`);
    }

    const roomData = await createRoomResponse.json();

    // Generate JWT for room access (simple signed token)
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({
      roomId: roomId,
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000)
    }));

    // Create signature using HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(serviceRoleKey.substring(0, 32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const token = `${btoa(String.fromCharCode(...data))}.${signatureBase64}`;

    return new Response(JSON.stringify({
      data: {
        roomId: roomId,
        token: token,
        expiresAt: expiresAt.toISOString(),
        roomUrl: `${req.headers.get('origin') || ''}/call/${roomId}`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Room creation error:', error);
    
    return new Response(JSON.stringify({
      error: {
        code: 'ROOM_CREATION_FAILED',
        message: error.message || 'Failed to create consultation room'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
