# Create the FINAL wrangler.toml with correct Stripe configuration
final_wrangler = '''name = "omni-clean-5-final"
main = "fwea-final-worker.js" 
compatibility_date = "2025-10-06"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "production"
HETZNER_SERVER = "https://178.156.190.229:8000"
STRIPE_PUBLISHABLE_KEY = "pk_live_51RW06LJ2Iq1764pCr02p7yLia0VqBgUcRfG7Qm5OWFNAwFZcexIs9iBB3B9s22elcQzQjuAUMBxpeUhwcm8hsDf900NbCbF3Vw"

# Add these as secrets using: wrangler secret put SECRET_NAME
# STRIPE_SECRET_KEY = "sk_live_..."
# STRIPE_WEBHOOK_SECRET = "whsec_tlkKwyVh1f7JKKggA13hjeIySOnZXGby"

[[kv_namespaces]]
binding = "AUDIO_SESSIONS"
id = "6a64a5d1cb7b4ac5bcaefaec65129a60"
preview_id = "your-preview-kv-namespace-id"

[[r2_buckets]]
binding = "AUDIO_FILES"
bucket_name = "omni-clean-audio"
preview_bucket_name = "omni-clean-audio-preview"

[triggers]
crons = ["0 0 * * *"]  # Daily cleanup of old files

[observability]
enabled = true

[limits]
cpu_ms = 50000
'''

# Write the wrangler config
with open('wrangler-final.toml', 'w') as f:
    f.write(final_wrangler)

print("✅ Created FINAL Wrangler Config: wrangler-final.toml")
print("🔧 Configuration:")
print("• Correct Stripe publishable key configured")
print("• Hetzner server endpoint set")
print("• KV namespace for session management")
print("• R2 bucket for audio file storage")
print("• Environment variables properly set")
print("\n📋 Next Steps:")
print("1. wrangler secret put STRIPE_SECRET_KEY")
print("2. wrangler secret put STRIPE_WEBHOOK_SECRET")
print("3. wrangler deploy fwea-final-worker.js")
