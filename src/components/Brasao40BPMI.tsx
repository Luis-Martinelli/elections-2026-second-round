import React from 'react';

interface Brasao40BPMIProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

export const Brasao40BPMI: React.FC<Brasao40BPMIProps> = ({
  className = '',
  size = 'md',
  alt = 'Brasão de Armas do 12º BPM/I - PMESP'
}) => {
  // Preset sizes
  const sizeClasses = {
    sm: 'w-10 h-auto',
    md: 'w-20 h-auto sm:w-24',
    lg: 'w-28 h-auto sm:w-32',
    xl: 'w-36 h-auto sm:w-44'
  };

  const finalClass = className || sizeClasses[size];

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      <img
        src="./public/brasao_12i.png"
        alt={alt}
        className={`${finalClass} object-contain filter drop-shadow-sm`}
        loading="eager"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes('/brasao_12i.png')) {
            target.src = '/brasao_12i.png';
          }
        }}
      />
    </div>
  );
};
