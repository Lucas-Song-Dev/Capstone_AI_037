# Testing Guide for Next.js Application

This project uses **Vitest** and **React Testing Library** for testing Next.js components and pages.

## Setup

The testing setup is already configured in:
- `vitest.config.ts` - Vitest configuration
- `src/test/setup.ts` - Test environment setup with Next.js mocks
- `src/test/next-test-utils.tsx` - Custom render function with providers

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

## Writing Tests

### Testing Next.js Pages

Pages in the `app/` directory are client components. Test them like regular React components:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/next-test-utils';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('should render correctly', () => {
    render(<HomePage />);
    expect(screen.getByText('DDR5 Power Calculator')).toBeInTheDocument();
  });
});
```

### Testing Components

Use the custom `render` from `@/test/next-test-utils` which includes all necessary providers:

```tsx
import { render, screen } from '@/test/next-test-utils';
import { MyComponent } from './MyComponent';

it('should render component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### Testing with Next.js Navigation

The setup file automatically mocks `next/navigation`. You can also customize mocks:

```tsx
import { vi } from 'vitest';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/current-path',
}));
```

### Testing Hooks

Use `renderHook` from React Testing Library:

```tsx
import { renderHook } from '@testing-library/react';
import { useConfig } from '@/contexts/ConfigContext';

it('should use config', () => {
  const { result } = renderHook(() => useConfig());
  expect(result.current.memspec).toBeDefined();
});
```

## Mocked Next.js Features

The test setup automatically mocks:
- `next/navigation` - useRouter, usePathname, useSearchParams
- `next/link` - Link component
- `next/image` - Image component

## Test File Naming

- Component tests: `ComponentName.test.tsx`
- Page tests: `page.test.tsx` (in the same directory as the page)
- Utility tests: `utility.test.ts`

## Best Practices

1. **Use the custom render**: Import from `@/test/next-test-utils` to get all providers
2. **Mock external dependencies**: Mock API calls, localStorage, etc.
3. **Test user interactions**: Use `fireEvent` or `userEvent` for interactions
4. **Test accessibility**: Use `getByRole`, `getByLabelText` for accessible queries
5. **Keep tests focused**: Each test should verify one behavior

## Example Test Structure

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/next-test-utils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Next.js Testing Documentation](https://nextjs.org/docs/app/building-your-application/testing)

