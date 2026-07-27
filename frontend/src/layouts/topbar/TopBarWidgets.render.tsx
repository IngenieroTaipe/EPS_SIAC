import type { TopBarWidget } from './TopBarConfig';
import {
  UpdatedAtWidget,
  AlertBadgeWidget,
  StatsWidget,
  LoadDataButton,
  LoginButton,
} from './TopBarWidgets';
import { cn } from '@/shared/lib/cn';

/**
 * Switch que mapea cada variante del union type `TopBarWidget` al componente
 * correspondiente. Vive en archivo aparte para que `TopBarWidgets.tsx` solo
 * exporte componentes (requisito del plugin `react-refresh`).
 *
 * Si añades un widget:
 *   1. Agrega el caso aquí.
 *   2. El componente debe estar en `TopBarWidgets.tsx`.
 */
export function renderWidget(widget: TopBarWidget) {
  switch (widget.kind) {
    case 'updatedAt':
      return <UpdatedAtWidget text={widget.text} key="updatedAt" />;
    case 'alertBadge':
      return <AlertBadgeWidget text={widget.text} key="alertBadge" />;
    case 'stats':
      return (
        <StatsWidget
          components={widget.components}
          critical={widget.critical}
          key="stats"
        />
      );
    case 'loadDataButton':
      return <LoadDataButton key="loadDataButton" />;
    case 'loginButton':
      return <LoginButton key="loginButton" />;
    default:
      return null;
  }
}

/** Clases compartidas para que el TopBar mantenga alturas iguales entre widgets. */
export const topbarSectionCx = cn(
  'h-20 inline-flex justify-center items-center gap-7',
);