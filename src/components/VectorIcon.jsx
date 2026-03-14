import React from 'react';
import { getDefaultIconSpec } from '../utils/iconSpecs';

const VectorIcon = ({
  spec = getDefaultIconSpec(),
  className = '',
  boxSize = 34,
  iconSize = 18,
  label,
}) => {
  const { Icon, color, background, strokeWidth } = spec;
  const dimension = typeof boxSize === 'number' ? `${boxSize}px` : boxSize;

  return (
    <span
      className={className}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        color,
        background,
        lineHeight: 0,
        flexShrink: 0,
      }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <Icon size={iconSize} strokeWidth={strokeWidth} />
    </span>
  );
};

export default VectorIcon;
