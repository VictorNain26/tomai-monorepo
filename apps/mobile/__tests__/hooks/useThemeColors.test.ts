import { renderHook } from '@testing-library/react-native';
import { darkColors, lightColors } from '@repo/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTheme } from '@/hooks/useTheme';

jest.mock('@/hooks/useTheme');
const mockUseTheme = jest.mocked(useTheme);

function mockScheme(isDark: boolean) {
  mockUseTheme.mockReturnValue({ isDark } as ReturnType<typeof useTheme>);
}

describe('useThemeColors', () => {
  it('dérive la palette light de @repo/tokens', () => {
    mockScheme(false);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.primary).toBe(lightColors['--color-primary']);
    expect(result.current.background).toBe(lightColors['--color-background']);
    expect(result.current.card).toBe(lightColors['--color-card']);
  });

  it('dérive la palette dark de @repo/tokens', () => {
    mockScheme(true);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.primary).toBe(darkColors['--color-primary']);
    expect(result.current.background).toBe(darkColors['--color-background']);
  });

  it('mappe mutedForeground sur --color-muted-foreground (texte, pas le fond --color-muted)', () => {
    mockScheme(false);
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.mutedForeground).toBe(lightColors['--color-muted-foreground']);
  });
});
