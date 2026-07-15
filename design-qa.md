# Design QA

- Source visual truth path: `/Users/garden/.codex/visualizations/2026/07/15/019f63a5-d31a-7df2-b66c-fce7d960d7c6/text-source-desktop.png`
- Implementation screenshot path: `/Users/garden/.codex/visualizations/2026/07/15/019f63a5-d31a-7df2-b66c-fce7d960d7c6/text-clone-1086-top.png`
- Mobile implementation screenshot path: `/Users/garden/.codex/visualizations/2026/07/15/019f63a5-d31a-7df2-b66c-fce7d960d7c6/text-clone-mobile.png`
- Viewport: 1086 x 873 desktop; 390 x 844 mobile
- State: 批量文生图，主图选中，表单与生成内容同屏展示

## Full-view comparison evidence

The source and implementation were reviewed together at the same desktop viewport. Both use a fixed top bar and left navigation, a larger form column, and an independently scrollable results column. The form contains the same four image-type tabs, large product-and-selling-point field, quantity stepper, model selector, optional Logo section, six aspect-ratio controls, and generation action. Result cards use the same time, command summary, model, ratio, image, and three follow-up actions.

The live source currently renders blue active states. The user explicitly requires the clone to retain the orange product direction, so this color deviation is intentional.

## Focused region comparison evidence

The full-view evidence keeps the four image-type controls, prompt field, quantity/model controls, ratio controls, and right-side result-card actions readable without a separate crop. Focused interaction checks additionally covered:

- Main, set, listing, and poster tab selection.
- Re-edit populating the form and restoring the task's image type.
- Mock generation adding a new result card without leaving the page.
- Text-to-image and image-to-image sharing the same result-card component.

## Required fidelity surfaces

- Fonts and typography: Chinese sans-serif hierarchy, task timestamps, metadata, labels, and small action text remain readable and close to the source density.
- Spacing and layout rhythm: the desktop split workspace matches the source's form-plus-results composition; mobile collapses to one column with no horizontal overflow.
- Colors and visual tokens: orange states are consistently applied per the user's explicit direction; background and card neutrals preserve the source's light workspace balance.
- Image quality and asset fidelity: local demo assets remain crisp and use correct cover behavior; no source assets are hotlinked.
- Copy and content: image types, form labels, metadata, history labels, and result-card actions match the observed source wording.

## Findings

No actionable P0, P1, or P2 issue remains.

## Comparison history

- Earlier P1: generated content lived on a separate history-detail route instead of beside the form.
- Fix: added a two-column desktop workspace and a shared inline results panel for text-to-image and image-to-image.
- Earlier P1: result cards did not expose the source actions and set-image multi-output behavior.
- Fix: added time, prompt/type, model, ratio, multi-image gallery, re-edit, regenerate, download notice, and pagination.
- Earlier P2: switching between text-to-image and image-to-image could retain the previous route's task list because React reused the component.
- Fix: refresh the filtered task list whenever `mode` changes.
- Post-fix evidence: desktop and mobile captures, four source tab checks, form refill verification, inline-generation verification, route-isolated task counts, and an empty browser error log.

## Implementation checklist

- [x] Capture the source form and inline result layout.
- [x] Verify all four image-type controls.
- [x] Verify the source re-edit behavior.
- [x] Implement the desktop split workspace.
- [x] Share one result UI between text-to-image and image-to-image.
- [x] Keep generated tasks on the current route.
- [x] Verify mobile width and browser logs.
- [x] Run the complete test and production-build suites.

## Follow-up polish

- P3: the source result column is slightly narrower at this exact viewport; the clone favors a little more room for metadata and action labels.

final result: passed
