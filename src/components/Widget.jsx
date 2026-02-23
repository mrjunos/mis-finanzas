import React from 'react';
import { twMerge } from 'tailwind-merge';

export default function Widget({ children, className = '' }) {
    return (
        <div className={twMerge(`glass-panel rounded-2xl p-6 shadow-sm`, className)}>
            {children}
        </div>
    );
}
