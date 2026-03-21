"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { User, Mail, Calendar, Shield, Zap } from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  plan: string;
  usage: number;
  apiKey: string;
  createdAt: string;
  provider: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("users")
        .select("plan, usage_this_month, seer_api_key, created_at")
        .eq("id", user.id)
        .single();

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      const provider = user.app_metadata?.provider || "email";

      setProfile({
        name,
        email: user.email || "",
        avatar: user.user_metadata?.avatar_url || "",
        plan: data?.plan || "free",
        usage: data?.usage_this_month || 0,
        apiKey: data?.seer_api_key || "",
        createdAt: data?.created_at || user.created_at || "",
        provider,
      });
      setLoading(false);
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted">
        <p>Unable to load profile. Please log in again.</p>
      </div>
    );
  }

  const joinDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-charcoal tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted">Your account details.</p>
      </div>

      {/* Profile card */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6 md:p-8">
        <div className="flex items-center gap-5">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-16 h-16 rounded-full border-2 border-sand/60"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-terracotta/15 flex items-center justify-center">
              <span className="text-terracotta font-display font-bold text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="font-display text-2xl text-charcoal">{profile.name}</h2>
            <p className="text-sm text-muted">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard
          icon={<Mail size={18} />}
          label="Email"
          value={profile.email}
        />
        <DetailCard
          icon={<Shield size={18} />}
          label="Auth Provider"
          value={profile.provider.charAt(0).toUpperCase() + profile.provider.slice(1)}
        />
        <DetailCard
          icon={<Zap size={18} />}
          label="Current Plan"
          value={profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
        />
        <DetailCard
          icon={<Calendar size={18} />}
          label="Joined"
          value={joinDate}
        />
      </div>

      {/* Usage summary */}
      <div className="bg-ivory rounded-2xl border border-sand/60 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-terracotta" />
          <h3 className="font-display text-lg text-charcoal">Usage This Month</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl text-charcoal tracking-tight">
            {profile.usage}
          </span>
          <span className="text-sm text-muted">API calls</span>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-ivory rounded-2xl border border-sand/60 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-terracotta">{icon}</span>
        <p className="text-xs font-semibold tracking-wider uppercase text-muted">
          {label}
        </p>
      </div>
      <p className="text-base font-medium text-charcoal">{value}</p>
    </div>
  );
}
