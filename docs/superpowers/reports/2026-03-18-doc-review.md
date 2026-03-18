# Documentation Review Report — 2026-03-18

## Summary

- Libraries reviewed: 11 (uikit, aikit, components, page-constructor, blog-constructor, date-components, navigation, graph, chartkit, table, dashkit)
- Components reviewed: 201
- Total issues: 753 (HIGH: 659, MEDIUM: 55, LOW: 39)

Top issue types:
- missing_prop: 492 occurrences across 11 libraries
- missing_from_data: 98 occurrences across 7 libraries
- phantom_prop: 33 occurrences across 8 libraries
- type_mismatch: 29 occurrences across 8 libraries
- missing_source: 4 occurrences across 2 libraries
- required_mismatch: 16 occurrences across 6 libraries
- default_mismatch: 6 occurrences across 2 libraries
- description_inaccurate: 17 occurrences across 8 libraries
- description_incomplete: 58 occurrences across 10 libraries

## Systemic Findings

**1. Wholesale empty props arrays in aikit, blog-constructor, graph, chartkit, and dashkit.**
The most pervasive data quality failure is not a prop-level mistake but a complete absence of prop data for entire libraries. In aikit, every component except ActionButton and Alert has `props: []` — this covers 32 out of 34 reviewed components (BaseMessage, ButtonGroup, ChatContainer, ChatDate, ContextIndicator, ContextItem, DiffStat, Disclaimer, Header, History, MessageBalloon, PromptInput, PromptInputFooter, PromptInputHeader, PromptInputPanel, RatingBlock, Shimmer, StarRating, Suggestions, Tabs, ThinkingMessage, ToolFooter, ToolHeader, ToolIndicator, ToolMessage, ToolStatus, UserMessage, and others). The same pattern is present in blog-constructor (all 10 components have empty or near-empty props), dashkit (ActionPanel and DashKitDnDWrapper), graph (Block, GraphCanvas), and chartkit (Loader). These libraries were not meaningfully ingested — the data skeleton exists but prop-level content was never populated. Any MCP consumer asking about component APIs for these libraries receives no useful information.

**2. page-constructor data covers only a fraction of its component surface area.**
The page-constructor library has 12 components in the reviewed data but the structural review identified at least 30 additional components present in source that have no data entries at all (Anchor, AnimateBlock, Author, BackLink, BackgroundImage, BackgroundMedia, BalancedMasonry, BlockBase, BrandFooter, ButtonTabs, Buttons, CardBase, ContentIcon, ContentLabels, ContentList, Control, FileLink, Foldable, FullWidthBackground, FullscreenImage, FullscreenMedia, HTML, HeaderBreadcrumbs, Icon, IconWrapper, Image, InnerForm, Links, MetaInfo, OutsideClick, OverflowScroller, RootCn, RouterLink, ToggleArrow, UnpublishedLabel, VideoBlock, YFMWrapper, YandexForm). Furthermore, the 12 components that are present (Button, Media, MediaBase, Link, Map, etc.) each have 3–18 missing props from inherited interfaces — critical fields like `image`, `video`, `youtube` in Media and layout props in MediaBase. Two components (Layout, ReactPlayerBlock) have no source file at all. The table library has a parallel problem: 3 of 3 reviewed components have prop issues, and ~22 sub-components are entirely absent from data.

**3. Phantom `style` prop spread across multiple uikit components that do not extend DOMProps.**
A recurring structural error in uikit is that 8 components list `style: React.CSSProperties` as a prop in their data entries even though their TSX interfaces do not extend `DOMProps` and have no `style` property. Affected components: Accordion, ActionsPanel, ArrowToggle, DefinitionList, Dialog, Disclosure, DropdownMenu, HelpMark, Label, Loader. This is a systematic ingest artifact — a `style` prop was added by default during data generation without verifying that the interface actually exposes it. This misleads consumers who would pass `style` to components that silently ignore it.

**4. Type narrowing errors throughout uikit create incorrect API documentation.**
At least 8 uikit components have type mismatches where the data documents a narrower type than the TSX source accepts. The most consequential examples: (a) `Alert.title` is documented as `string` but the source accepts `React.ReactNode`; (b) `Icon.color` is documented as `string` but the source restricts it to a design-system token union; (c) `Breadcrumbs.popupStyle` is documented as `React.CSSProperties` but the source uses the literal `'staircase'`; (d) `List.filterItem` documents a two-argument function but the source uses a curried form; (e) `Dialog.onClose` documents `() => void` but the source requires `(event, reason) => void`; (f) `Drawer.onResizeStart` is documented as `() => void` but the source types it as `(size: number) => void`. These errors would cause silent runtime failures when consumers build against the documented API.

**5. uikit descriptions contain factually wrong behavioral claims, not just omissions.**
Five uikit component descriptions make claims that contradict the TSX source: (a) `Avatar` claims it can be rendered as a button or link — no such prop exists; (b) `ArrowToggle` claims it animates to indicate open/closed state — the interface only has a static `direction` prop; (c) `CopyToClipboard` is described as render-prop-only when it also accepts a plain ReactElement; (d) `DefinitionList` claims copy-to-clipboard per item, a feature absent from the interface; (e) `Drawer` claims it supports backdrop dismissal, but `onOutsideClick` is explicitly omitted from DrawerProps. These are `description_inaccurate` issues, not mere omissions, and will actively mislead developers who rely on descriptions rather than source-diving.

## Per-Library Results

### aikit — 34 components, 286 issues (HIGH: 283, MEDIUM: 3, LOW: 0)

Note: The vast majority of HIGH issues are missing_prop because virtually all aikit component data entries have `props: []`. These are listed below by component with prop-count summaries rather than individual bullets for brevity.

#### HIGH

- **BaseMessage**: missing_prop — all 8 props absent from empty array (children, role, actions, userRating, timestamp, showTimestamp, showActionsOnHover, className, qa)
- **ButtonGroup**: missing_prop — all 4 props absent from empty array (children, orientation, className, qa)
- **ChatContainer**: missing_prop — all 24+ props absent from empty array (onSendMessage, chats, activeChat, messages, status, error, onCancel, onDeleteChat, onSelectChat, onCreateChat, onDeleteAllChats, onFold, onClose, onRetry, showActionsOnHover, contextItems, transformOptions, shouldParseIncompleteMarkdown, messageListConfig, headerProps, contentProps, emptyContainerProps, promptInputProps, disclaimerProps, historyProps, welcomeConfig, i18nConfig, showHistory, showNewChat, showFolding, showClose, hideTitleOnEmptyChat, className, headerClassName, contentClassName, footerClassName, qa)
- **ChatDate**: missing_prop — all 7 props absent from empty array (date, showTime, format, relative, className, style, qa)
- **ContextIndicator**: missing_prop — all 7 props absent from empty array (type, usedContext, maxContext, orientation, reversed, className, qa)
- **ContextItem**: missing_prop — all 4 props absent from empty array (content, onClick, className, qa)
- **DiffStat**: missing_prop — all 5 props absent from empty array (added, deleted, className, style, qa)
- **Disclaimer**: missing_prop — all 5 props absent from empty array (children, className, text, variant, qa)
- **Header**: missing_prop — all 16+ props absent from empty array (icon, title, preview, baseActions, handleNewChat, handleHistoryToggle, handleFolding, handleClose, additionalActions, historyButtonRef, foldingState, titlePosition, withIcon, showTitle, className)
- **History**: missing_prop — all 16+ props absent from empty array (chats, selectedChat, onSelectChat, onDeleteChat, onLoadMore, hasMore, loadMode, searchable, groupBy, showActions, emptyPlaceholder, emptyFilteredPlaceholder, className, filterFunction, loading, size, qa, style)
- **MessageBalloon**: missing_prop — all 3 props absent from empty array (children, className, qa)
- **PromptInput**: missing_prop — all 14+ props absent from empty array (view, onSend, onCancel, initialValue, disabled, status, maxLength, headerProps, bodyProps, footerProps, suggestionsProps, topPanel, bottomPanel, className, qa)
- **PromptInputFooter**: missing_prop — all 10+ props absent from empty array (submitButton, showSettings, onSettingsClick, showAttachment, onAttachmentClick, showMicrophone, onMicrophoneClick, children, className, buttonSize, qa)
- **PromptInputHeader**: missing_prop — all 6 props absent from empty array (contextItems, showContextIndicator, contextIndicatorProps, children, className, qa)
- **PromptInputPanel**: missing_prop — all 3 props absent from empty array (children, className, qa)
- **RatingBlock**: missing_prop — all 7 props absent from empty array (title, value, onChange, size, visible, className, qa)
- **Shimmer**: missing_prop — all 3 props absent from empty array (children, className, qa)
- **StarRating**: missing_prop — 2 props absent (aria-label, aria-label-star)
- **Suggestions**: missing_prop — all 8 props absent from empty array (items, onClick, title, layout, textAlign, wrapText, className, qa)
- **Tabs**: missing_prop — all 8 props absent from empty array (items, activeId, onSelectItem, onDeleteItem, allowDelete, className, style, qa)
- **ThinkingMessage**: missing_prop — all 10 props absent from empty array (content, status, title, defaultExpanded, showStatusIndicator, onCopyClick, enabledCopy, className, style, qa)
- **ToolFooter**: missing_prop — all 5 props absent from empty array (actions, content, showLoader, className, qa)
- **ToolHeader**: missing_prop — all 7 props absent from empty array (toolName, toolIcon, content, actions, status, className, qa)
- **ToolIndicator**: missing_prop — all 3 props absent from empty array (status, className, qa)
- **ToolMessage**: missing_prop — all 14 props absent from empty array (toolName, toolIcon, footerActions, headerActions, bodyContent, headerContent, footerContent, status, expandable, initialExpanded, autoCollapseOnSuccess, autoCollapseOnCancelled, onAccept, onReject, className, qa)
- **ToolStatus**: missing_prop — all 3 props absent from empty array (status, className, qa)
- **UserMessage**: missing_prop — all 13 props absent from empty array (content, format, showAvatar, avatarUrl, transformOptions, shouldParseIncompleteMarkdown, actions, showActionsOnHover, showTimestamp, timestamp, className, qa)
- **Alert**: phantom_prop — 'onClick' flattened from sub-object to top-level prop; duplicate phantom 'content' entry
- **Alert**: type_mismatch — 'button' prop type is truncated/malformed in data
- **InlineCitation**: missing_from_data — component exists in source but absent from data
- **InputContext**: missing_from_data — component exists in source but absent from data
- **PromptInputBody**: missing_from_data — component exists in source but absent from data
- **AssistantMessage**: missing_from_data — component exists in source but absent from data
- **MessageList**: missing_from_data — component exists in source but absent from data

#### MEDIUM

- **Alert**: required_mismatch — phantom 'content' entry marked required:true, real top-level 'content' is optional

---

### page-constructor — 12 components, 133 issues (HIGH: 130, MEDIUM: 2, LOW: 1)

#### HIGH

- **Button**: missing_prop — 'primary', 'target', 'extraProps', 'qa' absent from data
- **ImageBase**: missing_prop — 'src', 'alt', 'fetchPriority' absent from data
- **Link**: missing_prop — 'tabIndex', 'qa', 'extraProps' absent from data
- **Map**: missing_prop — 'className', 'markers', 'address' absent; address is required in GMapProps
- **Media**: missing_prop — 19 props absent including 'image', 'video', 'youtube', 'videoIframe', 'dataLens', 'color', 'height', 'previewImg', 'parallax', 'fullscreen', 'animated', 'videoMicrodata', 'iframe', 'margins', 'playButton', 'customBarControlsClassName', 'videoClassName', 'playVideo', 'imageClassName', 'isBackground', 'qa', 'ratio', 'disableImageSliderForArrayInput'
- **MediaBase**: missing_prop — 11 props absent including 'direction', 'mobileDirection', 'largeMedia', 'mediaOnly', 'mediaOnlyColSizes', 'animated', 'title', 'description', 'buttons', 'links', 'button'
- **Layout**: missing_source — no TSX source file found for this component in data
- **ReactPlayerBlock**: missing_source — no TSX source file found for this component in data
- **Table**: type_mismatch — 'justify' type representation is malformed (missing parentheses around union before array indicator)
- **Anchor, AnimateBlock, Author, BackLink, BackgroundImage, BackgroundMedia, BalancedMasonry, BlockBase, BrandFooter, ButtonTabs, Buttons, CardBase, ContentIcon, ContentLabels, ContentList, Control, FileLink, Foldable, FullWidthBackground, FullscreenImage, FullscreenMedia, HTML, HeaderBreadcrumbs, Icon, IconWrapper, Image, InnerForm, Links, MetaInfo, OutsideClick, OverflowScroller, RootCn, RouterLink, ToggleArrow, UnpublishedLabel, VideoBlock, YFMWrapper, YandexForm**: missing_from_data — 38 source components absent from data

#### MEDIUM

- **Link**: required_mismatch — 'url' is required in source but data marks it required:false
- **Map**: required_mismatch — 'address' is required in GMapProps but data marks it required:false

#### LOW

- **Title**: description_inaccurate — description says "supports various text sizes" but source uses column grid sizes; this is a factual error

---

### blog-constructor — 10 components, 58 issues (HIGH: 58, MEDIUM: 0, LOW: 0)

#### HIGH

- **FeedHeader**: missing_prop — all 10 props absent from empty array (handleLoadData, queryParams, tags, services, title, background, offset, theme, verticalOffset, className)
- **MetaWrapper**: missing_prop — 'metaComponent' and 'needHelmetWrapper' absent from empty array
- **Paginator**: missing_prop — all 8 props absent from empty array (page, totalItems, itemsPerPage, maxPages, onPageChange, queryParams, pageCountForShowSupportButtons, className)
- **PostCard**: missing_prop — all 6 props absent from empty array (post, fullWidth, showTag, size, titleHeadingLevel, analyticsEvents)
- **PostInfo**: missing_prop — all 6 props absent from empty array (postId, readingTime, date, theme, qa, analyticsEventsContainer)
- **Posts**: missing_prop — all 13 props absent from empty array (containerId, currentPage, isShowMoreVisible, errorShowMore, postCountOnPage, perPageInQuery, isFetching, handleShowMore, handlePageChange, queryParams, postsOnPage, pinnedPostOnPage, pageCountForShowSupportButtons)
- **PostsError**: missing_prop — 'onButtonClick' absent from near-empty array
- **PromptSignIn**: missing_prop — 'text', 'openTimestamp', 'openDuration', 'theme' absent; phantom_prop — 'message' and 'title' listed in data but not in source interface
- **Wrapper**: missing_prop — 'paddings', 'children', 'style', 'className', 'qa' absent from empty array

---

### date-components — 11 components, 107 issues (HIGH: 104, MEDIUM: 2, LOW: 1)

#### HIGH

- **CalendarView**: missing_prop — 'id', 'className', 'style', 'onFocus', 'onBlur' absent from data
- **DateField**: missing_prop — 'placeholderValue', 'errorPlacement', 'name', 'form', 'autoFocus', 'onKeyDown', 'onKeyUp' absent
- **DatePicker**: missing_prop — 15+ props absent: 'autoFocus', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp', 'name', 'form', 'id', 'style', 'open', 'defaultOpen', 'onOpenChange', 'popupClassName', 'popupStyle', 'popupPlacement', 'popupOffset', 'placeholderValue', 'isDateUnavailable', 'errorMessage', 'errorPlacement', 'children'
- **RangeCalendar**: missing_prop — 12 props absent: 'id', 'className', 'style', 'onFocus', 'onBlur', 'autoFocus', 'isWeekend', 'focusedValue', 'defaultFocusedValue', 'onFocusUpdate', 'mode', 'defaultMode', 'onUpdateMode', 'modes'
- **RangeDateField**: missing_prop — all props absent from empty array (value, defaultValue, onUpdate, delimiter, disabled, readOnly, size, format)
- **RangeDatePicker**: missing_prop — all props absent from empty array (value, defaultValue, onUpdate, disabled, size, format, hasClear, disablePortal, disableFocusTrap)
- **RangeDateSelection**: missing_prop — 14 props absent (value, defaultValue, onUpdate, minValue, maxValue, minDuration, maxDuration, align, placeholderValue, timeZone, numberOfIntervals, placeOnRuler, id, className, style); phantom_prop — 'interval' and 'dimensions' listed in data but are internal callback parameters, not top-level props
- **RelativeDateField**: missing_prop — 17 props absent including 'roundUp', 'errorPlacement', 'startContent', 'endContent', 'name', 'form', 'autoFocus', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp', popup style props, 'id', 'style'
- **RelativeDatePicker**: missing_prop — 19+ props absent including 'roundUp', 'isDateUnavailable', 'format', 'placeholderValue', 'parseDateFromString', 'errorMessage', 'errorPlacement', 'minValue', 'maxValue', 'id', 'name', 'form', 'style', 'autoFocus', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp', popup style props, 'children', 'onOpenChange'
- **RelativeRangeDatePicker**: missing_prop — all props absent from empty array (value, defaultValue, onUpdate, timeZone, minValue, maxValue, format, disabled, readOnly, withApplyButton, withZonesList, withPresets, withHeader, onOpenChange, renderControl, size, popupClassName)

#### MEDIUM

- **CalendarView**: required_mismatch — 'state' marked required correctly but no description in data entry
- **CalendarView**: description_inaccurate — data description is prop JSDoc for the 'size' prop, not a component description

#### LOW

- **RangeDateField, RangeDatePicker, RangeDateSelection, RelativeRangeDatePicker**: description_incomplete — no description field exists for these 4 components

---

### uikit — 71 components, 153 issues (HIGH: 119, MEDIUM: 22, LOW: 12)

#### HIGH

- **Accordion**: missing_prop — 'ariaLevel', 'ariaLabel' absent; phantom_prop — 'disabled', 'keepMounted', 'style' (style not in AccordionProps)
- **ActionsPanel**: missing_prop — 'noteClassName' absent; phantom_prop — 'style'; type_mismatch — 'actions' type uses wrong named types
- **Alert**: type_mismatch — 'title' documented as 'string' but source uses React.ReactNode
- **ArrowToggle**: phantom_prop — 'style' not in ArrowToggleProps
- **Avatar**: missing_prop — 'sizes', 'withImageBorder' absent
- **AvatarStack**: type_mismatch — 'renderMore' parameter shape is wrong (plain number vs {count: number} object)
- **Box**: missing_prop — 'width', 'height', 'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'position', 'qa' all absent
- **Breadcrumbs**: type_mismatch — 'popupStyle' documented as React.CSSProperties but source uses literal 'staircase'
- **Button**: type_mismatch — 'extraProps' documented as Record<string, unknown> but source uses proper HTML attributes type
- **Checkbox**: missing_prop — 'children', 'name', 'controlProps', 'controlRef', 'onFocus', 'onBlur' absent
- **Container**: missing_prop — 'qa' absent
- **ControlLabel**: missing_prop — all props absent from empty array (children, labelClassName, title, disabled, size, control, className, style, qa)
- **DefinitionList**: phantom_prop — 'style' not in DefinitionListProps; missing_prop — 'groupLabelClassName' absent
- **Dialog**: type_mismatch — 'onClose' signature missing event and reason parameters; phantom_prop — 'style'; missing_prop — 'modalClassName', 'initialFocus', 'returnFocus', 'disableHeightTransition', and 7 lifecycle callbacks absent
- **Disclosure**: phantom_prop — 'style'; missing_prop — 'children' absent
- **Drawer**: phantom_prop — 'onResizeComplete' does not exist; missing_prop — 'onResize', 'onResizeEnd' absent; type_mismatch — 'onResizeStart' missing size argument; missing_prop — 15 inherited modal props absent
- **DropdownMenu**: phantom_prop — 'style'; missing_prop — 6 switcher/menu/popup props absent
- **FilePreview**: type_mismatch — 'onClick' documented as receiving File but source has MouseEventHandler
- **Flex**: missing_prop — 'as', 'children', 'className', 'style', 'spacing' absent
- **HelpMark**: phantom_prop — 'buttonProps' wrapper does not exist; type_mismatch — 'popoverProps' excludes children in source but not in data
- **Icon**: type_mismatch — 'size' narrowed to number (should be number|string); type_mismatch — 'color' documented as plain string (should be design token union)
- **Label**: missing_prop — 'closeButtonLabel', 'copyButtonLabel', 'title' absent; type_mismatch — 'value' is React.ReactNode not string; type_mismatch — 'onCloseClick' element type wrong; phantom_prop — 'style'
- **Link**: missing_prop — 'extraProps' absent; phantom_prop — duplicate href entry with conflicting required flag
- **List**: type_mismatch — 'filterItem' curried form documented as uncurried; missing_prop — 'autoFocus', 'role', 'onScrollToItem', 'filterClassName', 'onFilterEnd', 'onFilterUpdate' absent
- **Loader**: phantom_prop — 'style' not in LoaderProps
- **NumberInput**: type_mismatch — 'tabIndex' documented as string (should be number)
- **PasswordInput**: missing_prop — all 6 props absent from empty array (hideCopyButton, hideRevealButton, showCopyTooltip, showRevealTooltip, revealValue, onRevealValueUpdate)
- **Popover**: missing_prop — 'returnFocus', 'initialFocus', 'disableVisuallyHiddenDismiss' absent
- **Popup**: missing_prop — 'focusOrder', 'anchorRef', 'floatingContext', 'floatingInteractions', 'floatingRef', 'floatingStyles', 'floatingClassName', 'onClose', 'onEscapeKeyDown', 'onOutsideClick' absent
- **Row**: missing_prop — 'qa' absent
- **Select**: missing_prop — 18 props absent including 'onClose', 'open', 'defaultOpen', all render* props, 'getOptionHeight', 'getOptionGroupHeight', 'filterOption', 'disablePortal', 'virtualizationThreshold', 'children', 'error'
- **Table**: missing_prop — 'onRowMouseDown', 'width', 'wordWrap', 'qa', 'aria-label', 'aria-labelledby', 'aria-describedby' absent
- **TableColumnSetup**: missing_prop — 'switcher' absent
- **Text**: type_mismatch — 'color' type includes open string (should be token union only)
- **TextArea**: missing_prop — all props absent from empty array
- **TextInput**: missing_prop — all props absent from empty array
- **Toc**: missing_prop — 'onItemClick' absent
- **Tooltip**: type_mismatch — 'onOpenChange' reason uses plain string instead of OpenChangeReason; type_mismatch — 'placement' uses string|string[] instead of PopupPlacement
- **TreeSelect**: missing_prop — all props absent from empty array
- **Virtualizer**: missing_prop — 'loading', 'onLoadMore' absent; phantom_prop — 'item', 'parentKey', 'renderChildren' are callback parameters promoted to top-level props; type_mismatch — 'renderRow' type is truncated/malformed

#### MEDIUM

- **Accordion**: default_mismatch — 'arrowPosition' default is 'end' in source, 'start' in data
- **Alert**: default_mismatch — 'align' default is 'baseline' in source, 'center' in data; default_mismatch — 'layout' default is 'vertical' in source, 'horizontal' in data
- **AvatarStack**: required_mismatch — 'children' is optional in source but required in data
- **Table**: default_mismatch — 'edgePadding' has default true in source but no default listed in data
- **Toc**: required_mismatch — 'items' is required in source but optional in data
- **ArrowToggle**: description_inaccurate — claims animation that does not exist in the interface
- **Avatar**: description_inaccurate — claims button/link rendering that no prop supports
- **CopyToClipboard**: description_inaccurate — described as render-prop-only when plain ReactElement is also accepted
- **DefinitionList**: description_inaccurate — claims copy-to-clipboard per item, absent from interface
- **Drawer**: description_inaccurate — claims backdrop dismissal when onOutsideClick is explicitly omitted
- **PasswordInput**: description_inaccurate — description is raw '<!--GITHUB_BLOCK-->' comment artifact
- **Portal**: description_inaccurate — incorrectly states it uses React.createPortal; uses FloatingPortal
- **Table (uikit)**: description_inaccurate — base Table does not provide sorting/selection; those are HOC behaviors
- **TextArea**: description_inaccurate — description is raw '<!--GITHUB_BLOCK-->' comment artifact
- **TextInput**: description_inaccurate — description is raw '<!--GITHUB_BLOCK-->' comment artifact
- **Tooltip**: description_inaccurate — claims text-only content and downplays actual trigger/placement capabilities
- **TreeSelect**: description_incomplete — description is null
- **Virtualizer**: description_incomplete — description is null

#### LOW

- **ActionsPanel**: description_incomplete — omits renderNote render-prop
- **ColorPicker**: description_incomplete — entire description is a stability warning with no behavioral content
- **Flex**: description_incomplete — example code uses deprecated 'space' prop
- **Label**: description_incomplete — omits value prop key:value display
- **Link**: description_incomplete — omits underline prop
- **List**: description_incomplete — omits drag-and-drop and infinite scroll
- **NumberInput**: description_incomplete — omits increment/decrement controls, min/max, step, shiftMultiplier
- **Overlay**: description_incomplete — omits visible and background props
- **Pagination**: description_incomplete — description too vague
- **Popover**: description_incomplete — implies hover+click always both active; misrepresents trigger behavior
- **Skeleton**: description_incomplete — omits animation prop variants
- **Slider**: description_incomplete — describes "data set" instead of continuous min/max/step range

---

### navigation — 10 components, 50 issues (HIGH: 43, MEDIUM: 5, LOW: 2)

#### HIGH

- **AsideHeader**: missing_prop — 'renderFooterAfter', 'onClosePanel', 'onMenuMoreClick', 'onAllPagesClick', 'openModalSubscriber', 'onMenuGroupsChanged', 'qa' absent; type_mismatch — 'renderFooter' callback missing 'isCompactMode' parameter
- **Logo**: phantom_prop — 'pinned' does not exist in LogoProps; phantom_prop — 'buttonWrapperClassName' does not match any real prop name ('buttonClassName' and 'iconPlaceClassName' are the real names)
- **MobileHeader**: missing_prop — 'burgerMenu' (required), 'overlapPanel', 'burgerCloseTitle', 'burgerOpenTitle', 'topAlert', 'renderContent', 'sideItemRenderContent', 'onEvent', 'onClosePanel', 'contentClassName' absent; phantom_prop — 'menuItems' is not a direct prop (nested under burgerMenu.items); type_mismatch — 'panelItems' documented as ModalItem[] but source uses PanelItemProps[]
- **MobileLogo**: missing_prop — 'text', 'className', 'icon', 'iconSrc', 'iconClassName', 'iconSize', 'textSize', 'href', 'target', 'wrapper', 'onClick' absent from sparse data (only 'isExpanded' documented)
- **Settings**: missing_prop — 'renderSectionRightAdornment' absent
- **TopAlert**: missing_prop — all 3 props absent from empty array (alert, className, mobileView)
- **Title**: missing_from_data — component exists in source and is exported but absent from data

#### MEDIUM

- **Footer**: required_mismatch — 'copyright' is required in source but data marks it required:false
- **Logo**: required_mismatch — 'text' is required in source but data marks it required:false
- **MobileHeader**: required_mismatch — 'logo' is required in source but data marks it required:false
- **AsideHeader**: description_inaccurate — claims color customization with no color prop; replaces functional description with marketing language
- **Logo**: description_inaccurate — references non-existent 'hasWrapper' prop instead of real 'wrapper' prop

#### LOW

- **ActionBar**: description_incomplete — adds layout assumptions not present in source interface
- **Footer**: description_incomplete — omits all notable props

---

### table — 3 components, 44 issues (HIGH: 43, MEDIUM: 0, LOW: 1)

#### HIGH

- **BaseTable**: type_mismatch — 'emptyContent' omits function variant from union type; type_mismatch — 'renderCustomFooterContent' callback signature completely wrong ({rows} vs {cellClassName, footerGroups, rowClassName, rowIndex})
- **SortableList**: missing_prop — 'items' (required), 'onDragStart', 'onDragEnd', 'enableNesting', 'childModeOffset', 'nextChildModeOffset' absent
- **ActionsCell, BaseCell, BaseDraggableRow, BaseFooterCell, BaseFooterRow, BaseGroupHeader, BaseHeaderCell, BaseHeaderRow, BaseResizeHandle, BaseRow, BaseSort, BaseSortIndicator, DragHandle, LastSelectedRowContext, RangedSelectionCheckbox, ReorderingProvider, RowActions, RowActionsMenu, RowLink, SelectionCheckbox, SortIndicator, SortableListContext, Table, TableSettings, TableSettingsColumn, TreeExpandableCell**: missing_from_data — 23 source components absent from data

#### LOW

- **SortableList**: description_incomplete — no description in data
- **SortableListDndContext**: description_incomplete — no description in data

---

### dashkit — 2 components, 19 issues (HIGH: 19, MEDIUM: 0, LOW: 0)

#### HIGH

- **ActionPanel**: missing_prop — all 4 props absent from empty array (items, className, disable, toggleAnimation)
- **DashKitDnDWrapper**: missing_prop — all 5 props absent from empty array (dragImageSrc, onDropDragOver, onDragStart, onDragEnd, children)
- **DashKit, DashKitView, GridItem, GridLayout, Item, MobileLayout, OverlayControls**: missing_from_data — 7 source components absent from data

---

### graph — 4 components, 37 issues (HIGH: 37, MEDIUM: 0, LOW: 0)

#### HIGH

- **Block**: missing_prop — all 7 props absent from empty array (graph, block, children, className, containerClassName, autoHideCanvas, canvasVisible)
- **GraphCanvas**: missing_prop — all 15 props absent from empty array (graph, className, blockListClassName, renderBlock, reactLayerRef, children, click, dblclick, onCameraChange, onBlockDragStart, onBlockDrag, onBlockDragEnd, onBlockSelectionChange, onBlockAnchorSelectionChange, onBlockChange, onConnectionSelectionChange, onStateChanged)
- **GraphBlockAnchor**: missing_source — no TSX source file found
- **GraphContextProvider**: missing_source — no TSX source file found
- **BlocksList, GraphLayer, GraphPortal**: missing_from_data — 3 source components absent from data

---

### chartkit — 1 component, 7 issues (HIGH: 7, MEDIUM: 0, LOW: 0)

#### HIGH

- **Loader**: missing_prop — 'renderPluginLoader', 'size', 'className', 'qa' absent from data
- **ChartKit, ErrorBoundary, SplitPane**: missing_from_data — 3 source components absent from data

---

### components — 17 components, 17 issues (HIGH: 10, MEDIUM: 5, LOW: 2)

#### HIGH

- **Gallery**: type_mismatch — 'onOpenChange' signature omits event and reason parameters
- **Notifications**: missing_prop — 'qa' absent from data
- **SharePopover**: missing_prop — 'children', 'copyIcon', 'copyTitle', 'renderCopy', 'onClick', 'buttonAriaLabel' absent
- **Notification**: missing_from_data — component exported from index but absent from data

#### MEDIUM

- **ConfirmDialog**: required_mismatch — 4 props marked required in data but optional in source (onClickButtonApply, onClickButtonCancel, textButtonApply, textButtonCancel)
- **InfiniteScroll**: required_mismatch — 'children' is required in source but data marks it optional
- **SharePopover**: required_mismatch — 'url' is required in source but data marks it optional
- **OnboardingMenu**: description_inaccurate — claims "onboarding presets" which is a fabricated feature not in source
- **PromoSheet**: description_inaccurate — description incorrectly constrains to mobile-app new-feature announcements

#### LOW

- **Reactions**: description_incomplete — omits palette popup, tooltip support, read-only mode, render props
- **SharePopover**: description_incomplete — omits Web Share API, hover/click activation modes

---

## Appendix: Issue Type Reference

- missing_prop — prop exists in TSX interface but absent from data (HIGH)
- phantom_prop — prop exists in data but not found in TSX interface (HIGH)
- missing_source — no TSX source file found for component in data (HIGH)
- missing_from_data — component exists in TSX source but absent from data (HIGH)
- type_mismatch — prop type differs between TSX and data (HIGH)
- required_mismatch — required/optional flag differs (MEDIUM)
- default_mismatch — default value differs (MEDIUM)
- description_inaccurate — description contains factually wrong claims (MEDIUM)
- description_incomplete — description omits significant behavior (LOW)
