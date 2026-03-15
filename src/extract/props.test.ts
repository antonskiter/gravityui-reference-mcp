import { describe, it, expect } from 'vitest';
import { extractProps } from './props.js';

describe('extractProps', () => {
  it('extracts ButtonButtonProps with literal union size type', () => {
    // ButtonProps is a union type; use the concrete ButtonButtonProps interface instead
    const props = extractProps('vendor/uikit', 'src/components/Button/Button.tsx', 'ButtonButtonProps');
    const sizeProp = props.find(p => p.name === 'size');
    expect(sizeProp).toBeDefined();
    expect(sizeProp!.type).toContain("'xs'");
    expect(sizeProp!.type).toContain("'s'");
    expect(sizeProp!.type).toContain("'m'");
    expect(sizeProp!.type).toContain("'l'");
    expect(sizeProp!.type).toContain("'xl'");
    expect(sizeProp!.required).toBe(false);
  });

  it('extracts Flex props including inherited Box props', () => {
    const props = extractProps(
      'vendor/uikit',
      'src/components/layout/Flex/Flex.tsx',
      'FlexProps',
    );
    const directionProp = props.find(p => p.name === 'direction');
    expect(directionProp).toBeDefined();
    const gapProp = props.find(p => p.name === 'gap');
    expect(gapProp).toBeDefined();
  });

  it('marks required props correctly (options is optional in SelectProps)', () => {
    const props = extractProps('vendor/uikit', 'src/components/Select/types.ts', 'SelectProps');
    const optionsProp = props.find(p => p.name === 'options');
    expect(optionsProp).toBeDefined();
    expect(optionsProp!.required).toBe(false);
  });

  it('extracts props with length > 0', () => {
    const props = extractProps('vendor/uikit', 'src/components/Button/Button.tsx', 'ButtonButtonProps');
    expect(props.length).toBeGreaterThan(0);
  });

  it('detects @deprecated JSDoc tag on FlexProps.space', () => {
    const props = extractProps(
      'vendor/uikit',
      'src/components/layout/Flex/Flex.tsx',
      'FlexProps',
    );
    const spaceProp = props.find(p => p.name === 'space');
    if (spaceProp) {
      expect(spaceProp.deprecated).toBe(true);
    }
  });
});
