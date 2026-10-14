'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const analysis = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (hasMinLength) score += 1;
    if (hasUppercase) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    let label = 'Enter password';
    let color = 'bg-[#414a44]';
    let textColor = 'text-[#69756d]';

    if (password.length > 0) {
      if (score <= 1) {
        label = 'Weak security entropy';
        color = 'bg-[#ef8c8c]';
        textColor = 'text-[#ef8c8c]';
      } else if (score === 2) {
        label = 'Moderate protection';
        color = 'bg-[#e9ad71]';
        textColor = 'text-[#e9ad71]';
      } else if (score === 3) {
        label = 'Strong credential';
        color = 'bg-[#9cc4d9]';
        textColor = 'text-[#9cc4d9]';
      } else {
        label = 'Enterprise standard';
        color = 'bg-[#d8f57b]';
        textColor = 'text-[#d8f57b]';
      }
    }

    return {
      score,
      label,
      color,
      textColor,
      rules: [
        { label: '8+ chars', met: hasMinLength },
        { label: 'Uppercase', met: hasUppercase },
        { label: 'Number', met: hasNumber },
        { label: 'Symbol', met: hasSpecial },
      ],
    };
  }, [password]);

  if (!password) {
    return null;
  }

  return (
    <div className="w-full mt-2 mb-3 p-2.5 rounded bg-[rgba(10,13,12,0.6)] border border-[rgba(236,233,223,0.08)]">
      {/* 4-bar indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ba69e]">Entropy Check:</span>
        <span className={`text-[11px] font-mono ${analysis.textColor} font-medium`}>{analysis.label}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 h-1.5 mb-2.5">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={`h-full rounded-full transition-all duration-300 ${
              idx < analysis.score ? analysis.color : 'bg-[rgba(236,233,223,0.08)]'
            }`}
          />
        ))}
      </div>

      {/* Rules pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] font-mono">
        {analysis.rules.map((rule, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              rule.met
                ? 'text-[#d8f57b] bg-[rgba(216,245,123,0.08)]'
                : 'text-[#69756d] bg-[rgba(236,233,223,0.02)]'
            }`}
          >
            {rule.met ? <Check className="w-2.5 h-2.5 flex-shrink-0" /> : <X className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />}
            <span className="truncate">{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
