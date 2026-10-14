import Link from 'next/link';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function BrandLogo({ size = 'md', showSubtitle = false }: BrandLogoProps) {
  const sizeClasses = {
    sm: { text: 'text-lg', mark: 'scale-90', sub: 'text-[10px]' },
    md: { text: 'text-2xl', mark: 'scale-100', sub: 'text-xs' },
    lg: { text: 'text-3xl', mark: 'scale-125', sub: 'text-xs' },
  }[size];

  return (
    <Link 
      href="/" 
      className="inline-flex items-center gap-3 group focus:outline-none"
      aria-label="Cairnwise Home"
    >
      <div className={`brand-mark-cairn ${sizeClasses.mark}`} aria-hidden="true" />
      <div className="flex flex-col">
        <span 
          style={{ fontFamily: 'var(--font-serif)' }}
          className={`${sizeClasses.text} tracking-tight font-normal text-[#f2efe7] leading-none group-hover:text-white transition-colors`}
        >
          Cairn<em className="text-[#d8f57b] not-italic font-normal ml-[1px]">wise</em>
        </span>
        {showSubtitle && (
          <span 
            style={{ fontFamily: 'var(--font-mono)' }}
            className={`${sizeClasses.sub} text-[#69756d] tracking-widest uppercase mt-1`}
          >
            Evidence before certainty
          </span>
        )}
      </div>
    </Link>
  );
}
