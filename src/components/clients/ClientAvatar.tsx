import { useClientLogo, getClientInitials } from '../../hooks/useClientLogo';
import type { Client } from '../../types';

interface ClientAvatarProps {
  client: Client;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackColor?: boolean;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
};

const logoSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export function ClientAvatar({
  client,
  size = 'md',
  className = '',
  showFallbackColor = true,
}: ClientAvatarProps) {
  const { logoUrl, isLoading } = useClientLogo(client);

  const initials = getClientInitials(client.name);

  // Mit Logo
  if (logoUrl) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center overflow-hidden bg-white border border-gray-100 ${className}`}
      >
        <img
          src={logoUrl}
          alt={`${client.name} Logo`}
          className={`${logoSizeClasses[size]} object-contain`}
          onError={(e) => {
            // Fallback zu Initialen wenn Bild nicht lädt
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center ${className}`}
        style={{ backgroundColor: showFallbackColor ? `${client.color}20` : 'transparent' }}
      >
        <div
          className="w-3 h-3 border-2 rounded-full animate-spin"
          style={{
            borderColor: `${client.color}30`,
            borderTopColor: client.color,
          }}
        />
      </div>
    );
  }

  // Fallback: Initialen mit Farbe
  return (
    <div
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center font-medium ${className}`}
      style={{
        backgroundColor: showFallbackColor ? `${client.color}20` : 'transparent',
        color: client.color,
      }}
    >
      {initials}
    </div>
  );
}

// Einfachere Version nur für kleine Dots (z.B. in Listen)
export function ClientDot({ client, size = 'md' }: { client: Client; size?: 'sm' | 'md' | 'lg' }) {
  const { logoUrl } = useClientLogo(client);

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${dotSizes[size]} rounded-sm object-contain`}
      />
    );
  }

  return (
    <div
      className={`${dotSizes[size]} rounded-full`}
      style={{ backgroundColor: client.color }}
    />
  );
}
