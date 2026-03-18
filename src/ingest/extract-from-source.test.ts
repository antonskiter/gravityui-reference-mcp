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

  // --- Pattern A: Object.assign ---

  it('handles Object.assign with internal forwardRef component', () => {
    const source = `
const _Button = React.forwardRef(function Button<T>(
    props: ButtonProps<T>,
    ref: React.Ref<HTMLButtonElement>,
) {
    return <button ref={ref} />;
});
export const Button = Object.assign(_Button, {Icon: ButtonIcon});`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Button');
    expect(info!.propsInterfaceName).toBe('ButtonProps');
  });

  it('handles Object.assign with named re-export', () => {
    const source = `
const ActionBar = ({children, className}: Props) => {
    return <section>{children}</section>;
};
const PublicActionBar = Object.assign(ActionBar, {
    Section: ActionBarSection,
});
export {PublicActionBar as ActionBar};`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('ActionBar');
    expect(info!.propsInterfaceName).toBe('Props');
  });

  it('handles Object.assign with arrow function component', () => {
    const source = `
const FormRowComponent = ({
    className,
    label,
    required = false,
    children,
    direction = 'row',
}: FormRowProps) => {
    return <div />;
};
export const FormRow = Object.assign(FormRowComponent, {FieldDescription: FormRowFieldDescription});`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('FormRow');
    expect(info!.propsInterfaceName).toBe('FormRowProps');
  });

  // --- Pattern B: React.memo ---

  it('handles React.memo wrapped component', () => {
    const source = `
export const Notifications = React.memo(function Notifications(props: NotificationsProps) {
    return <div />;
});`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Notifications');
    expect(info!.propsInterfaceName).toBe('NotificationsProps');
  });

  // --- Pattern C: forwardRef with function reference ---

  it('handles forwardRef with function reference (not inline)', () => {
    const source = `
function DelayedTextInputComponent(props: DelayedTextInputProps, ref: React.Ref<HTMLInputElement>) {
    return <input ref={ref} />;
}
export const DelayedTextInput = React.forwardRef(DelayedTextInputComponent);`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('DelayedTextInput');
    expect(info!.propsInterfaceName).toBe('DelayedTextInputProps');
  });

  // --- Pattern D: Function with generic type params + multi-line destructured props ---

  it('handles exported function with generics and multi-line params', () => {
    const source = `
export function HotkeysPanel<T = {}>({
    open,
    onClose,
    leftOffset,
    hotkeys,
}: HotkeysPanelProps<T>) {
    return <div />;
}`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('HotkeysPanel');
    expect(info!.propsInterfaceName).toBe('HotkeysPanelProps');
  });

  it('handles arrow function with multi-line params containing nested parens', () => {
    const source = `
export const PromptSignIn = ({
    text = i18n(Keyset.PromptSignInOnLike),
    onClickSignIn = () => alert(i18n(Keyset.SignIn)),
    actions = [{children: 'Sign In'}],
    ...props
}: PromptSignInProps) => <Prompt {...{text, actions}} {...props} />;`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('PromptSignIn');
    expect(info!.propsInterfaceName).toBe('PromptSignInProps');
  });

  it('handles Drawer-style arrow function with many destructured props', () => {
    const source = `
export const Drawer = ({
    open,
    onOpenChange,
    placement = 'left',
    children,
    resizable = false,
    hideVeil = false,
    ...restProps
}: DrawerProps) => {
    return <div />;
};`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Drawer');
    expect(info!.propsInterfaceName).toBe('DrawerProps');
  });

  // --- Pattern E: export default ---

  it('handles export default with arrow function component', () => {
    const source = `
export interface TitleProps {
    title: string;
}
const Title = ({title, className}: TitleProps & ClassNameProps) => {
    return <div>{title}</div>;
};
export default Title;`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Title');
    expect(info!.propsInterfaceName).toBe('TitleProps');
  });

  it('handles export default class component', () => {
    const source = `
export default class Table extends React.Component<TableProps & ClassNameProps> {
    render() {
        return <div />;
    }
}`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Table');
    expect(info!.propsInterfaceName).toBe('TableProps');
  });

  // --- Pattern F: class extends React.Component ---

  it('handles exported class component with simple generics', () => {
    const source = `
export class ItemSelector<T> extends React.Component<ItemSelectorProps<T>> {
    static defaultProps = {};
    render() { return <div />; }
}`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('ItemSelector');
    expect(info!.propsInterfaceName).toBe('ItemSelectorProps');
  });

  it('handles exported class component with complex nested generics', () => {
    const source = `
export class Table<I extends TableDataItem = Record<string, string>> extends React.Component<
    TableProps<I>,
    TableState
> {
    render() { return <div />; }
}`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Table');
    expect(info!.propsInterfaceName).toBe('TableProps');
  });

  // --- Pattern G: Complex typed forwardRef ---

  it('handles ForwardRefExoticComponent typed const with forwardRef', () => {
    const source = `
export const Icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>> &
    IconComposition = React.forwardRef<SVGSVGElement, IconProps>(
    ({data, width, height}, ref) => {
        return <svg ref={ref} />;
    },
);`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Icon');
    expect(info!.propsInterfaceName).toBe('IconProps');
  });

  it('handles FC typed const (non-React. prefix)', () => {
    const source = `
import type {FC} from 'react';
export const Footer: FC<FooterProps> = ({className, menuItems}) => {
    return <footer />;
};`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('Footer');
    expect(info!.propsInterfaceName).toBe('FooterProps');
  });

  // --- Pattern: forwardRef with inline multi-line destructured props ---

  it('handles forwardRef with inline arrow and destructured typed params', () => {
    const source = `
export const BaseTable = React.forwardRef(
    <TData, TScrollElement extends Element | Window = HTMLDivElement>(
        {
            table,
            className,
            stickyHeader = false,
        }: BaseTableProps<TData, TScrollElement>,
        ref: React.Ref<HTMLTableElement>,
    ) => {
        return <table ref={ref} />;
    },
) as (<TData>(props: BaseTableProps<TData>) => React.ReactElement);`;
    const info = extractComponentInfo(source);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('BaseTable');
    expect(info!.propsInterfaceName).toBe('BaseTableProps');
  });
});
