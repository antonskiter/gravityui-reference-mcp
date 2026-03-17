# New Recipes Batch — 10 Recipes

## Goal
Add 10 new recipes to achieve full library coverage (all 7 Gravity UI libraries) and cross-library composition patterns.

## Existing Recipes (5)
- confirmation-dialog (molecule) — uikit, components
- data-table (organism) — uikit, components
- file-upload (organism) — uikit, components
- page-states (molecule) — uikit
- theming-dark-mode (foundation) — uikit

## New Recipes (10)

### Foundation (1)
1. **app-shell** — navigation + uikit
   AsideHeader with Logo, compact mode toggle, Footer, MobileHeader for responsive. Routing integration with menu items.
   Components: AsideHeader, Logo, Footer, MobileHeader (navigation), Button, Icon (uikit)

### Molecule (3)
2. **date-range-filter** — date-components + uikit
   RangeCalendar with preset buttons (7 days, 30 days, custom). Popover trigger with formatted display.
   Components: RangeCalendar, DateField (date-components), Popover, Button, Label (uikit)

3. **user-feedback** — uikit + components
   Unified notification system: Toaster for transient, Alert for persistent inline, Notifications for notification center.
   Components: Toaster, Alert (uikit), Notifications (components)

4. **search-with-suggestions** — uikit
   TextInput with Popover autocomplete dropdown, debounced search, keyboard navigation (ArrowUp/Down/Enter/Escape).
   Components: TextInput, Popover, List, Loader, Hotkey (uikit)

### Organism (6)
5. **form-with-validation** — uikit + components
   Multi-field form with FormRow layout, per-field validation, error messages, disabled submit until valid.
   Components: TextInput, Select, Checkbox, Button (uikit), FormRow (components)

6. **multi-step-wizard** — uikit + components
   Stepper-driven flow, per-step validation before advance, back/next/submit buttons, Dialog wrapper option.
   Components: Stepper, Button, Dialog (uikit), FormRow (components)

7. **settings-page** — navigation + uikit
   Navigation Settings component with sections, each section has controls (Switch, Select, RadioGroup).
   Components: Settings (navigation), Switch, Select, RadioGroup, Button, Divider (uikit)

8. **dashboard-layout** — navigation + uikit + date-components (3 libraries!)
   Full dashboard: AsideHeader sidebar, date range filter, metric cards (Card), action toolbar (ActionBar).
   Components: AsideHeader, ActionBar (navigation), RangeCalendar (date-components), Card, Text, Button, Select (uikit)

9. **advanced-data-grid** — table + uikit
   BaseTable with TanStack Table, sortable columns, column visibility (TableColumnSetup), pagination, row selection.
   Components: BaseTable (table), TableColumnSetup, Pagination, Checkbox, Button (uikit)

10. **landing-page** — page-constructor + uikit
    Marketing page using page-constructor blocks: hero, features grid, CTA. PromptSignIn (blog-constructor) as auth gate.
    Components: Title, Button, Link (page-constructor), Text, Card (uikit), PromptSignIn (blog-constructor)

## Library Coverage After
- uikit: all 15 recipes
- components: 7 recipes
- navigation: 3 recipes (app-shell, settings-page, dashboard-layout)
- date-components: 2 recipes (date-range-filter, dashboard-layout)
- table: 1 recipe (advanced-data-grid)
- page-constructor: 1 recipe (landing-page)
- blog-constructor: 1 recipe (landing-page)

## Quality Standards
Each recipe must:
- Pass RecipeDefSchema validation
- Have decision + example sections at minimum
- Use short library IDs (uikit, not @gravity-ui/uikit)
- Have realistic, working code examples
- Cross-reference related existing recipes
- Follow existing recipe structure patterns from data/recipes.json
