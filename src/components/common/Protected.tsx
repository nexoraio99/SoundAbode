import React from 'react';

export interface ProtectedProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  children: React.ReactNode;
}

/**
 * Lightweight wrapper component for scoped content protection.
 * Attaches the `data-protected="true"` attribute to its DOM element.
 */
export const Protected: React.FC<ProtectedProps> = ({
  as: Component = 'div',
  children,
  className = '',
  ...props
}) => {
  return (
    <Component data-protected="true" className={className} {...props}>
      {children}
    </Component>
  );
};

export default Protected;
