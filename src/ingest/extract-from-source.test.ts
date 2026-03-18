import { describe, it, expect } from 'vitest';
import { extractPropsFromSource, extractComponentInfo } from './extract-from-source.js';

describe('extractPropsFromSource', () => {
  it('extracts props from interface', () => {
    const source = `
export interface ButtonProps {
  /** Button size */
  size?: 's' | 'm' | 'l' | 'xl';
  /** Whether the button is disabled */
  disabled?: boolean;
  children: React.ReactNode;
}`;
    const props = extractPropsFromSource(source, 'ButtonProps');
    expect(props).toHaveLength(3);
    expect(props[0]).toMatchObject({
      name: 'size',
      type: "'s' | 'm' | 'l' | 'xl'",
      required: false,
      description: 'Button size',
    });
    expect(props[2]).toMatchObject({
      name: 'children',
      type: 'React.ReactNode',
      required: true,
    });
  });

  it('extracts props with default values from destructured params', () => {
    const source = `
export interface FlexProps {
  gap?: number;
  direction?: 'row' | 'column';
}
export const Flex = ({gap = 0, direction = 'row'}: FlexProps) => {};`;
    const props = extractPropsFromSource(source, 'FlexProps');
    expect(props[0].default).toBe('0');
    expect(props[1].default).toBe("'row'");
  });

  it('returns empty array when interface not found', () => {
    const props = extractPropsFromSource('const x = 1;', 'NonExistent');
    expect(props).toEqual([]);
  });
});

describe('extractComponentInfo', () => {
  it('finds component name and props interface from forwardRef', () => {
    const source = `
/** A flexible box layout component */
export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({gap, direction = 'row', ...rest}, ref) => {
    return <div ref={ref} />;
  }
);`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Flex');
    expect(info!.propsInterfaceName).toBe('FlexProps');
    expect(info!.description).toBe('A flexible box layout component');
  });

  it('finds function component export', () => {
    const source = `
/** Graph canvas component */
export function GraphCanvas({graph, ...props}: GraphProps) {
  return <div />;
}`;
    const info = extractComponentInfo(source);
    expect(info!.name).toBe('GraphCanvas');
    expect(info!.propsInterfaceName).toBe('GraphProps');
  });

  it('returns null for non-component files', () => {
    const source = `export const BATCH_SIZE = 10;`;
    const info = extractComponentInfo(source);
    expect(info).toBeNull();
  });

  it('handles React.FC typed components', () => {
    const source = `export const Alert: React.FC<AlertProps> = ({type}) => <div />;`;
    const info = extractComponentInfo(source);
    expect(info!.name).toBe('Alert');
    expect(info!.propsInterfaceName).toBe('AlertProps');
  });
});
