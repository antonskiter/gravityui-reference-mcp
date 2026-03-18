# Layout Recipes Batch — 4 Recipes

## Goal

Add 4 layout-focused recipes to data/recipes.json covering the core Gravity UI layout primitives: Flex, Row+Col grid, Box+Container spacing, and a full page shell. These recipes give Claude Code concrete, copy-paste patterns for the most common layout decisions.

## Existing Recipes Referenced

- app-shell (organism) — navigation + uikit (AsideHeader shell pattern)
- form-with-validation (organism) — uikit (uses Row+Col for form layout)
- dashboard-layout (organism) — navigation + uikit (uses Container + Flex)

## New Recipes (4)

### Foundation (3)

1. **flex-layout** — uikit
   Linear arrangement of elements with configurable direction, gap, alignment, and responsive direction change.
   Components: Flex (uikit), Box (uikit, optional)

2. **grid-layout** — uikit
   12-column responsive grid with Row and Col. Supports fluid breakpoint sizing and column wrapping.
   Components: Row (uikit), Col (uikit), Flex (uikit, optional for inner content)

3. **spacing-and-containers** — uikit
   Spacing tokens via Box spacing prop and page-width constraints via Container. Polymorphic semantic elements.
   Components: Box (uikit), Container (uikit)

### Organism (1)

4. **page-layout** — navigation + uikit
   Top-level application page shell: AsideHeader sidebar + renderContent with Container and Flex column layout. Composes the three foundation recipes inside a navigation shell.
   Components: AsideHeader (navigation), Container, Flex, Row, Col (uikit)

---

## Schema Reference

All recipes must conform to the RecipeDefSchema used in data/recipes.json. The exact shape of each recipe object:

```
{
  id: string,
  title: string,
  description: string,
  level: "foundation" | "molecule" | "organism",
  use_cases: string[],
  packages: string[],
  tags: string[],
  sections: Section[]
}
```

Section types (in order, all optional except decision + example):
- decision: { type, when, not_for, matrix? }
- setup: { type, steps }
- components: { type, items: [{ name, library, usage, role }] }
- custom_parts: { type, items: [{ name, description, approach }] }
- structure: { type, tree, flow }
- example: { type, title, code }  — one object per code example
- avoid: { type, items: string[] }
- related: { type, items: [{ id, note }] }

---

## Recipe 1: flex-layout

```json
{
  "id": "flex-layout",
  "title": "Flex Layout",
  "description": "Arrange items horizontally or vertically with consistent gaps using the Flex component. Supports responsive direction, alignment shortcuts, wrapping, and inline display.",
  "level": "foundation",
  "use_cases": [
    "build a horizontal toolbar with evenly spaced action buttons",
    "stack form fields or cards vertically with consistent gap",
    "center content both horizontally and vertically in a container",
    "switch from column layout on mobile to row layout on desktop"
  ],
  "packages": ["@gravity-ui/uikit"],
  "tags": ["layout", "flex", "gap", "stack", "toolbar", "alignment", "responsive", "direction"],
  "sections": [
    {
      "type": "decision",
      "when": "You need a linear (single-axis) arrangement of elements with consistent gaps, optional alignment control, or responsive direction. Flex is the lowest-level layout primitive — reach for it whenever you need to line things up horizontally or vertically.",
      "not_for": "Multi-column grid layouts with defined column widths (use grid-layout recipe with Row+Col). Page-level shells with sidebars (use page-layout recipe). Spacing/padding on a single element without siblings (use Box spacing prop).",
      "matrix": [
        {
          "situation": "Horizontal row of buttons with gap between them",
          "component": "Flex",
          "why": "direction='row' with gap applies uniform spacing between children without margin hacks."
        },
        {
          "situation": "Vertical stack of cards or form fields",
          "component": "Flex",
          "why": "direction='column' with gap stacks children vertically with design-token spacing."
        },
        {
          "situation": "Centered hero content or loading spinner",
          "component": "Flex",
          "why": "centerContent prop sets justify-content:center and align-items:center in one prop."
        },
        {
          "situation": "Multi-column layout with specific column widths",
          "component": "Row + Col",
          "why": "Row+Col is the 12-column grid system; use it when column proportions matter."
        }
      ]
    },
    {
      "type": "components",
      "items": [
        {
          "name": "Flex",
          "library": "uikit",
          "usage": "required",
          "role": "Main layout primitive. Key props: direction (AdaptiveProp<'flexDirection'>, supports responsive object {s: 'column', m: 'row'}), gap (Space token: '0'|'0.5'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'), gapRow (row gap for wrapping layouts), wrap (true or CSS flexWrap value), centerContent (shortcut for justify+align center), alignItems, justifyContent, grow, inline, as (polymorphic element tag)."
        },
        {
          "name": "Box",
          "library": "uikit",
          "usage": "optional",
          "role": "Wrap individual Flex children that need padding, margin, or overflow control. Use spacing prop with SpacingProps shape: {p, px, py, pt, pr, pb, pl, m, mx, my, mt, mr, mb, ml} with Space token values."
        }
      ]
    },
    {
      "type": "example",
      "title": "Horizontal toolbar with gap between buttons",
      "code": "import {Flex, Button} from '@gravity-ui/uikit';\n\nexport function Toolbar() {\n  return (\n    <Flex direction=\"row\" gap=\"2\" alignItems=\"center\">\n      <Button view=\"action\">Save</Button>\n      <Button view=\"normal\">Cancel</Button>\n      <Button view=\"flat-danger\">Delete</Button>\n    </Flex>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Vertical card stack",
      "code": "import {Flex, Card, Text} from '@gravity-ui/uikit';\n\nexport function CardStack({items}: {items: {id: string; title: string; body: string}[]}) {\n  return (\n    <Flex direction=\"column\" gap=\"4\">\n      {items.map((item) => (\n        <Card key={item.id} type=\"container\" view=\"outlined\">\n          <Flex direction=\"column\" gap=\"2\">\n            <Text variant=\"subheader-2\">{item.title}</Text>\n            <Text color=\"secondary\">{item.body}</Text>\n          </Flex>\n        </Card>\n      ))}\n    </Flex>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Responsive direction: column on small screens, row on medium and above",
      "code": "import {Flex, Card, Text} from '@gravity-ui/uikit';\n\nexport function ResponsiveRow() {\n  return (\n    <Flex direction={{s: 'column', m: 'row'}} gap=\"4\" wrap={true}>\n      <Flex grow={true}>\n        <Card type=\"container\" view=\"outlined\">\n          <Text variant=\"subheader-2\">Primary content</Text>\n        </Card>\n      </Flex>\n      <Flex basis=\"240px\" shrink={0}>\n        <Card type=\"container\" view=\"outlined\">\n          <Text variant=\"subheader-2\">Sidebar</Text>\n        </Card>\n      </Flex>\n    </Flex>\n  );\n}"
    },
    {
      "type": "avoid",
      "items": [
        "Using the deprecated space prop on Flex — it applies negative margins that break layout in containers; use gap instead",
        "Using Flex for 12-column grid layouts where column widths are defined by fractions — use Row+Col for that",
        "Nesting multiple Flex components when a single Row+Col would express the intent more clearly",
        "Using inline styles for alignment (style={{display:'flex'}}) — Flex handles all flex CSS through props",
        "Passing a pixel string to gap — gap only accepts Space tokens ('1', '2', '4' etc.), not arbitrary CSS values"
      ]
    },
    {
      "type": "related",
      "items": [
        {
          "id": "grid-layout",
          "note": "Use Row+Col when you need 12-column proportional widths instead of single-axis flex."
        },
        {
          "id": "spacing-and-containers",
          "note": "Use Box for per-element spacing (padding, margin) and Container for page-width constraints."
        },
        {
          "id": "page-layout",
          "note": "Flex is used inside renderContent to stack the page body sections vertically."
        }
      ]
    }
  ]
}
```

---

## Recipe 2: grid-layout

```json
{
  "id": "grid-layout",
  "title": "Grid Column Layout",
  "description": "Build responsive multi-column layouts with the Row and Col 12-column grid system. Columns adapt across breakpoints (s, m, l, xl, xxl) and wrap automatically.",
  "level": "foundation",
  "use_cases": [
    "build a two-column form layout with equal-width fields",
    "display three dashboard metric cards side-by-side, stacking on mobile",
    "create a sidebar (narrow) + main content (wide) split layout",
    "build a responsive card gallery that reflows from 1 to 2 to 3 columns"
  ],
  "packages": ["@gravity-ui/uikit"],
  "tags": ["layout", "grid", "columns", "responsive", "row", "col", "breakpoints", "12-column"],
  "sections": [
    {
      "type": "decision",
      "when": "You need columns with defined widths based on a 12-column system. Use Row+Col when the relative proportions of columns matter or when columns must reflow across breakpoints.",
      "not_for": "Simple horizontal alignment where all items share equal, auto-sized space (use Flex). Single-column vertical stacking (use Flex direction column). Content that needs precise CSS Grid (display:grid) features like areas or auto-fill tracks.",
      "matrix": [
        {
          "situation": "Two equal columns",
          "component": "Row + Col size={6}",
          "why": "6+6 columns = 12 total, equal halves. Row handles the gutter, Col handles the width."
        },
        {
          "situation": "Sidebar (25%) + content (75%)",
          "component": "Row + Col size={3} and Col size={9}",
          "why": "3+9 = 12. This is the canonical sidebar split in a 12-column system."
        },
        {
          "situation": "Responsive: 1 col mobile, 2 col tablet, 3 col desktop",
          "component": "Col size={[12, {m: 6, l: 4}]}",
          "why": "Array format: first element is default (mobile), second is a partial breakpoint map."
        }
      ]
    },
    {
      "type": "components",
      "items": [
        {
          "name": "Row",
          "library": "uikit",
          "usage": "required",
          "role": "Grid row container. Props: space (Space token or MediaPartial<Space>, sets column gaps between Col children), spaceRow (Space token or MediaPartial<Space>, sets vertical gap when cols wrap). Always wrap Col components inside Row."
        },
        {
          "name": "Col",
          "library": "uikit",
          "usage": "required",
          "role": "Grid column. Props: size (ColSize 1-12, or [defaultSize, MediaPartial<ColSize>] for responsive, or plain MediaPartial<ColSize> object). ColSize accepts string ('6') or number (6). Responsive forms: size={[12, {m: 6}]} = full width by default, half on medium+. size={{s: 12, m: 6, l: 4}} = responsive object form."
        },
        {
          "name": "Flex",
          "library": "uikit",
          "usage": "optional",
          "role": "Use inside Col to arrange the column's inner content (e.g., stack a card title and body vertically, or align an icon with text horizontally)."
        }
      ]
    },
    {
      "type": "example",
      "title": "Two equal columns (form layout)",
      "code": "import {Row, Col, TextInput, Button, Flex} from '@gravity-ui/uikit';\n\nexport function TwoColumnForm() {\n  return (\n    <Flex direction=\"column\" gap=\"6\">\n      <Row space=\"4\">\n        <Col size={6}>\n          <TextInput label=\"First name\" placeholder=\"Enter first name\" />\n        </Col>\n        <Col size={6}>\n          <TextInput label=\"Last name\" placeholder=\"Enter last name\" />\n        </Col>\n      </Row>\n      <Row space=\"4\">\n        <Col size={12}>\n          <TextInput label=\"Email\" placeholder=\"Enter email\" />\n        </Col>\n      </Row>\n      <Button view=\"action\">Submit</Button>\n    </Flex>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Responsive card grid: full width mobile, 2 columns medium, 3 columns large",
      "code": "import {Row, Col, Card, Text} from '@gravity-ui/uikit';\n\nconst metrics = [\n  {id: '1', label: 'Total Users', value: '12,430'},\n  {id: '2', label: 'Active Sessions', value: '847'},\n  {id: '3', label: 'Revenue', value: '$94,210'},\n];\n\nexport function MetricCards() {\n  return (\n    <Row space=\"4\" spaceRow=\"4\">\n      {metrics.map((metric) => (\n        <Col key={metric.id} size={[12, {m: 6, l: 4}]}>\n          <Card type=\"container\" view=\"outlined\">\n            <Text variant=\"body-2\" color=\"secondary\">{metric.label}</Text>\n            <Text variant=\"display-2\">{metric.value}</Text>\n          </Card>\n        </Col>\n      ))}\n    </Row>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Sidebar (size 3) + main content (size 9)",
      "code": "import {Row, Col, Flex, Text, Card} from '@gravity-ui/uikit';\n\nexport function SidebarLayout({sidebar, children}: {sidebar: React.ReactNode; children: React.ReactNode}) {\n  return (\n    <Row space=\"6\">\n      <Col size={[12, {m: 3}]}>\n        {sidebar}\n      </Col>\n      <Col size={[12, {m: 9}]}>\n        {children}\n      </Col>\n    </Row>\n  );\n}"
    },
    {
      "type": "avoid",
      "items": [
        "Using a Col offset prop — Col has no offset prop; use an empty Col or Flex margin to create visual offsets",
        "Using deprecated individual breakpoint props on Col (s, m, l, xl, xxl) — use size={[default, {m: value, l: value}]} or size={{s:12, m:6}} instead",
        "Placing non-Col elements as direct children of Row — Row expects Col children for correct gutter calculation",
        "Using Row+Col for a simple horizontal button group — that is Flex territory (Row+Col adds 12-column semantics you don't need)",
        "Forgetting spaceRow when cols are expected to wrap — without spaceRow the wrapped rows will have no vertical gap"
      ]
    },
    {
      "type": "related",
      "items": [
        {
          "id": "flex-layout",
          "note": "Use Flex for single-axis linear arrangements where column proportions don't need to snap to a 12-column grid."
        },
        {
          "id": "spacing-and-containers",
          "note": "Wrap the Row in a Container to constrain the total page width and add horizontal gutters."
        },
        {
          "id": "page-layout",
          "note": "Row+Col is used inside the page content area when a multi-column content grid is needed."
        }
      ]
    }
  ]
}
```

---

## Recipe 3: spacing-and-containers

```json
{
  "id": "spacing-and-containers",
  "title": "Spacing and Containers",
  "description": "Control element spacing (padding and margin) with Box and constrain page-level width with Container. Replaces inline styles for spacing with design-token-based Space values.",
  "level": "foundation",
  "use_cases": [
    "add consistent padding to a section wrapper using design tokens",
    "center page content with a max-width constraint",
    "use semantic HTML elements (section, article, nav, main) with design-system spacing",
    "apply shorthand spacing (all sides, axis, or individual side) via a single prop"
  ],
  "packages": ["@gravity-ui/uikit"],
  "tags": ["layout", "spacing", "padding", "margin", "container", "max-width", "box", "semantic", "tokens"],
  "sections": [
    {
      "type": "decision",
      "when": "You need to control the spacing of a single element (padding/margin) or constrain the width of a page section. Box is the spacing primitive; Container is the page-width wrapper.",
      "not_for": "Gaps between sibling elements (use gap prop on Flex or space prop on Row). Column-based grid layouts (use Row+Col). Sidebar/navigation shells (use page-layout recipe).",
      "matrix": [
        {
          "situation": "Section needs uniform padding",
          "component": "Box",
          "why": "Box spacing prop accepts {p: '4'} to apply padding on all sides using a design token value."
        },
        {
          "situation": "Page content should be centered and not exceed a max width",
          "component": "Container",
          "why": "Container centers content with auto margins and applies a predefined max-width from the breakpoint scale."
        },
        {
          "situation": "Need a <section> or <article> element with spacing",
          "component": "Box as='section'",
          "why": "The as prop makes Box polymorphic — it renders the chosen HTML element while still applying spacing tokens."
        }
      ]
    },
    {
      "type": "components",
      "items": [
        {
          "name": "Box",
          "library": "uikit",
          "usage": "required",
          "role": "Spacing primitive. Props: spacing (SpacingProps: {p, px, py, pt, pr, pb, pl, m, mx, my, mt, mr, mb, ml} — all values are Space tokens '0'|'0.5'|'1'..'10'), overflow ('hidden'|'x'|'y'|'auto'), width/height/maxWidth/maxHeight/minWidth/minHeight (CSS strings), position (CSS position), as (polymorphic HTML tag or component)."
        },
        {
          "name": "Container",
          "library": "uikit",
          "usage": "required",
          "role": "Page-width constraint. Centers content horizontally with auto margins. Props: maxWidth (MediaType breakpoint name: 'xs'|'s'|'m'|'l'|'xl'|'xxl'|'xxxl'), gutters (Space token or false — controls horizontal padding inside the container), spaceRow (Space token or MediaPartial<Space> — gap between Row children), as (HTML tag)."
        }
      ]
    },
    {
      "type": "example",
      "title": "Box as semantic section element with padding",
      "code": "import {Box, Text} from '@gravity-ui/uikit';\n\nexport function PageSection({title, children}: {title: string; children: React.ReactNode}) {\n  return (\n    <Box as=\"section\" spacing={{py: '8', px: '6'}}>\n      <Text as=\"h2\" variant=\"header-2\">{title}</Text>\n      <Box spacing={{mt: '4'}}>\n        {children}\n      </Box>\n    </Box>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Container centering page content with max-width",
      "code": "import {Container, Flex, Text} from '@gravity-ui/uikit';\n\nexport function PageContent({children}: {children: React.ReactNode}) {\n  return (\n    <Container maxWidth=\"l\" gutters=\"6\">\n      <Flex direction=\"column\" gap=\"6\">\n        {children}\n      </Flex>\n    </Container>\n  );\n}"
    },
    {
      "type": "example",
      "title": "Box spacing shorthand for card internal layout",
      "code": "import {Box, Flex, Text, Button} from '@gravity-ui/uikit';\n\nexport function InfoCard({title, description, onAction}: {\n  title: string;\n  description: string;\n  onAction: () => void;\n}) {\n  return (\n    <Box spacing={{p: '5'}} maxWidth=\"360px\">\n      <Flex direction=\"column\" gap=\"3\">\n        <Text variant=\"subheader-2\">{title}</Text>\n        <Text color=\"secondary\">{description}</Text>\n        <Box spacing={{mt: '2'}}>\n          <Button view=\"action\" onClick={onAction}>Learn more</Button>\n        </Box>\n      </Flex>\n    </Box>\n  );\n}"
    },
    {
      "type": "avoid",
      "items": [
        "Using inline style={{padding: '...'}} for spacing — use Box spacing prop to stay on design token values",
        "Passing pixel values to spacing — spacing only accepts Space tokens ('0', '0.5', '1'..'10'), not arbitrary CSS strings",
        "Nesting multiple Containers on the same page — use one Container at the outermost level per content region; nesting Containers double-applies max-width constraints",
        "Using Container maxWidth with a pixel string — maxWidth accepts breakpoint names ('xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'), not CSS pixel values",
        "Using Box where Flex gap is cleaner — if you only need spacing between sibling elements, Flex gap is more semantic"
      ]
    },
    {
      "type": "related",
      "items": [
        {
          "id": "flex-layout",
          "note": "Use Flex gap for spacing between siblings; use Box spacing for padding/margin on a single element."
        },
        {
          "id": "grid-layout",
          "note": "Wrap Row+Col layouts in a Container to constrain total page width and add gutters."
        },
        {
          "id": "page-layout",
          "note": "Container is the direct child of AsideHeader's renderContent, constraining the content region width."
        }
      ]
    }
  ]
}
```

---

## Recipe 4: page-layout

```json
{
  "id": "page-layout",
  "title": "Application Page Layout",
  "description": "Assemble a complete application page with AsideHeader sidebar navigation and a structured content area using Container and Flex. Composes the flex-layout, grid-layout, and spacing-and-containers foundation recipes inside a navigation shell.",
  "level": "organism",
  "use_cases": [
    "build an admin panel with persistent sidebar navigation and constrained content width",
    "add a collapsible sidebar to an existing content page",
    "create an application shell where every page shares the same navigation and content structure",
    "combine AsideHeader with a Container+Flex content layout for consistent page anatomy"
  ],
  "packages": ["@gravity-ui/uikit", "@gravity-ui/navigation"],
  "tags": ["layout", "page", "sidebar", "navigation", "aside-header", "application", "shell", "container", "flex"],
  "sections": [
    {
      "type": "decision",
      "when": "You are building the top-level page structure of an application that needs both sidebar navigation and a content area with controlled width. This recipe composes AsideHeader (navigation shell) with Container+Flex (content layout).",
      "not_for": "Layouts inside content sections — use Flex or Row+Col there. Pages without persistent sidebar navigation — use Container+Flex directly. Full navigation shell setup with routing (use app-shell recipe for the navigation concern)."
    },
    {
      "type": "setup",
      "steps": [
        "npm install @gravity-ui/navigation @gravity-ui/uikit",
        "Import navigation CSS: import '@gravity-ui/navigation/styles/styles.css'",
        "Import uikit CSS: import '@gravity-ui/uikit/styles/fonts.css' and import '@gravity-ui/uikit/styles/styles.css'",
        "Wrap your app in ThemeProvider from @gravity-ui/uikit if not already done"
      ]
    },
    {
      "type": "components",
      "items": [
        {
          "name": "AsideHeader",
          "library": "navigation",
          "usage": "required",
          "role": "Top-level sidebar navigation shell. Required prop: pinned (boolean). Key props: renderContent (renders the page body area, receives {size} — current sidebar width as a number), renderFooter (bottom sidebar content), menuItems (AsideHeaderItem[]), logo (LogoProps), isCompactMode (boolean), hideCollapseButton (boolean)."
        },
        {
          "name": "Container",
          "library": "uikit",
          "usage": "required",
          "role": "Constrains content width and centers it. Place directly inside renderContent. Props: maxWidth (breakpoint name: 'xs'|'s'|'m'|'l'|'xl'|'xxl'|'xxxl'), gutters (Space token for horizontal padding)."
        },
        {
          "name": "Flex",
          "library": "uikit",
          "usage": "required",
          "role": "Stacks content sections vertically inside the Container. Use direction='column' with gap to separate page sections (page header, main body, etc.)."
        },
        {
          "name": "Row",
          "library": "uikit",
          "usage": "optional",
          "role": "12-column grid inside the content area when the page needs multi-column sections. Use with Col for sidebar+content splits or card grids."
        },
        {
          "name": "Col",
          "library": "uikit",
          "usage": "optional",
          "role": "Grid columns inside Row. Use size prop with responsive values to build content grids within the page body."
        },
        {
          "name": "Box",
          "library": "uikit",
          "usage": "optional",
          "role": "Add padding to page sections or sub-areas. Use spacing prop with Space tokens."
        }
      ]
    },
    {
      "type": "structure",
      "tree": [
        "PageLayout  (organism root)",
        "  AsideHeader  (pinned, logo, menuItems)",
        "    renderContent={({size}) =>",
        "      main  (as='main', paddingLeft=size handles sidebar offset)",
        "        Container  (maxWidth='l', gutters='6')",
        "          Flex  (direction='column', gap='6')",
        "            Box  (page header area, spacing={{py: '4'}})",
        "              Text  (page title, variant='header-1')",
        "              Flex  (direction='row', gap='2' — page-level toolbar)",
        "            [page body sections]",
        "              Row+Col  (optional, for multi-column content grids)",
        "    }",
        "    renderFooter={({isExpanded}) =>",
        "      Footer or custom footer links",
        "    }"
      ],
      "flow": [
        "1. AsideHeader renders with pinned=true initially (optionally persisted to localStorage)",
        "2. renderContent receives {size} — the current sidebar width in px",
        "3. The main element uses paddingLeft=size (with CSS transition) to push content as sidebar expands/collapses",
        "4. Container constrains the content to maxWidth='l' and adds horizontal gutters",
        "5. Flex direction='column' stacks the page header and body sections with uniform gap",
        "6. Page sections can use Row+Col internally for multi-column sub-layouts",
        "7. User collapses sidebar -> size decreases -> main paddingLeft transitions -> content expands"
      ]
    },
    {
      "type": "example",
      "title": "Full application page layout with AsideHeader, Container, and Flex content stack",
      "code": "import React from 'react';\nimport {AsideHeader} from '@gravity-ui/navigation';\nimport {Container, Flex, Box, Text, Button} from '@gravity-ui/uikit';\nimport {House, Gear, Persons} from '@gravity-ui/icons';\n\nexport function AppPage({children}: {children: React.ReactNode}) {\n  const [pinned, setPinned] = React.useState(true);\n\n  return (\n    <AsideHeader\n      pinned={pinned}\n      onChangePinned={setPinned}\n      logo={{\n        icon: House,\n        text: 'My App',\n        href: '/',\n      }}\n      menuItems={[\n        {id: 'home', title: 'Home', icon: House, current: true},\n        {id: 'users', title: 'Users', icon: Persons},\n        {id: 'settings', title: 'Settings', icon: Gear},\n      ]}\n      renderContent={({size}) => (\n        <Box\n          as=\"main\"\n          style={{paddingLeft: size, transition: 'padding-left 0.2s'}}\n        >\n          <Container maxWidth=\"l\" gutters=\"6\">\n            <Flex direction=\"column\" gap=\"6\">\n              <Box spacing={{py: '4'}}>\n                <Flex direction=\"row\" justifyContent=\"space-between\" alignItems=\"center\">\n                  <Text variant=\"header-1\">Dashboard</Text>\n                  <Button view=\"action\">New item</Button>\n                </Flex>\n              </Box>\n              {children}\n            </Flex>\n          </Container>\n        </Box>\n      )}\n    />\n  );\n}"
    },
    {
      "type": "avoid",
      "items": [
        "Hardcoding the sidebar width — always use the size argument from renderContent to offset the main content area",
        "Omitting the required pinned prop on AsideHeader — it is required and the component will not render correctly without it",
        "Placing Container inside the sidebar (renderFooter) instead of inside renderContent — Container is for the content area, not the sidebar",
        "Nesting AsideHeader inside another layout element — AsideHeader should be the outermost layout component for the page",
        "Using the app-shell recipe as a replacement — app-shell covers full navigation setup with routing; this recipe covers the content layout structure inside the shell",
        "Forgetting to import @gravity-ui/navigation/styles/styles.css — the sidebar will render without correct styling"
      ]
    },
    {
      "type": "related",
      "items": [
        {
          "id": "flex-layout",
          "note": "Used inside renderContent to stack page sections vertically with consistent gaps."
        },
        {
          "id": "grid-layout",
          "note": "Used inside the content area for multi-column layouts within a page section."
        },
        {
          "id": "spacing-and-containers",
          "note": "Container and Box are the spacing/constraint primitives used inside renderContent."
        },
        {
          "id": "app-shell",
          "note": "Use app-shell for full navigation setup with routing, mobile header, and footer. Use page-layout when you only need the structural content layout pattern."
        }
      ]
    }
  ]
}
```

---

## Quality Standards

Each recipe must:
- Pass RecipeDefSchema validation (id, title, description, level, use_cases, packages, tags, sections)
- Have at minimum: decision section and one example section
- Use short library IDs in component.library field (uikit, navigation — not @gravity-ui/uikit)
- Use only verified props from the VERIFIED API section at the top of this document
- Import layout components (Flex, Row, Col, Box, Container) from '@gravity-ui/uikit'
- Import AsideHeader from '@gravity-ui/navigation'
- All Space token values must be string literals from the set: '0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
- Cross-reference sibling layout recipes in related sections

## Implementation Notes

- flex-layout and grid-layout are independent; implement in either order
- spacing-and-containers has no deps on flex-layout or grid-layout but examples use Flex for inner content
- page-layout depends on all three foundation recipes conceptually; implement last
- None of these recipes require a setup section except page-layout (two packages)
- The level values: flex-layout=foundation, grid-layout=foundation, spacing-and-containers=foundation, page-layout=organism
