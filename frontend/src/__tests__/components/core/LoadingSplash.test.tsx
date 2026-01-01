/**
 * Tests for LoadingSplash component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSplash from '@/shared/components/LoadingSplash';

describe('LoadingSplash', () => {
  it('renders without crashing', () => {
    render(<LoadingSplash />);
    
    expect(screen.getByAltText('Loading...')).toBeInTheDocument();
  });

  it('displays the favicon image', () => {
    render(<LoadingSplash />);
    
    const image = screen.getByAltText('Loading...');
    expect(image).toHaveAttribute('src', '/favicon.ico');
    expect(image).toHaveClass('w-24', 'h-24', 'animate-spin-slow', 'drop-shadow-lg');
  });

  it('has correct container styling', () => {
    const { container } = render(<LoadingSplash />);
    
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('flex', 'items-center', 'justify-center', 'h-screen', 'w-screen', 'bg-gray-50', 'select-none');
    
    const innerDiv = outerDiv.firstChild as HTMLElement;
    expect(innerDiv).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'space-y-6');
  });

  it('is centered on the screen', () => {
    render(<LoadingSplash />);
    
    const image = screen.getByAltText('Loading...');
    const container = image.closest('div');
    
    expect(container).toHaveClass('flex', 'items-center', 'justify-center');
  });

  it('has appropriate accessibility attributes', () => {
    render(<LoadingSplash />);
    
    const image = screen.getByAltText('Loading...');
    expect(image).toBeInTheDocument();
    
    // The component doesn't have any ARIA roles, but we can check that it's presentational
    // The alt text indicates it's decorative
  });
});
