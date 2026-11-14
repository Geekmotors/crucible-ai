import { MalformedSurfaceName } from './malformed-surface-name.enum.js';
import { SpecCaseId } from './spec-case-id.enum.js';
import { SpecSurface } from './spec-surface.util.js';
import { SurfaceDetector } from './surface-detector.enum.js';
import type { SurfaceItem, SurfaceManifest } from './surface-check.util.js';

type Section = Exclude<keyof SurfaceManifest, 'operations'>;

type Malformation = [MalformedSurfaceName, SurfaceManifest, SurfaceDetector];

class MalformedSurface {
  private static base: SurfaceManifest = SpecSurface.manifest;

  private static unknownOption = 'retries';

  private static wrongDefault = 3;

  private static wrongProviders = ['openrouter'];

  static all(): Malformation[] {
    return [
      ...MalformedSurface.citations(),
      ...MalformedSurface.listings(),
      [
        MalformedSurfaceName.OperationMissing,
        { ...MalformedSurface.base, operations: MalformedSurface.base.operations.slice(1) },
        SurfaceDetector.OperationDrift,
      ],
    ];
  }

  private static citations(): Malformation[] {
    return [
      [
        MalformedSurfaceName.Uncited,
        MalformedSurface.firstItem('runOptions', { fixtures: [] }),
        SurfaceDetector.Uncited,
      ],
      [
        MalformedSurfaceName.UnknownCase,
        MalformedSurface.firstItem('runOptions', { fixtures: [SpecCaseId.NoSuchCase] }),
        SurfaceDetector.UnknownCases,
      ],
      [
        MalformedSurfaceName.OptionNotExercised,
        MalformedSurface.firstItem('runOptions', { fixtures: [SpecCaseId.VerdictSingleFailed] }),
        SurfaceDetector.Unexercised,
      ],
      [
        MalformedSurfaceName.CallOptionOfOtherAssertion,
        MalformedSurface.firstItem('callOptions', { fixtures: [SpecCaseId.ExtractFactsString] }),
        SurfaceDetector.Unexercised,
      ],
      [
        MalformedSurfaceName.CallOptionOnlyRunFacts,
        MalformedSurface.firstItem('callOptions', { fixtures: [SpecCaseId.CoherentRunFactsOnly] }),
        SurfaceDetector.Unexercised,
      ],
      [
        MalformedSurfaceName.WrongErrorKind,
        MalformedSurface.firstItem('errorKinds', {
          kind: 'usage',
          retryable: undefined,
          fixtures: [SpecCaseId.ConfigNoFile],
        }),
        SurfaceDetector.Unexercised,
      ],
      [
        MalformedSurfaceName.WrongRetryable,
        MalformedSurface.firstItem('errorKinds', {
          kind: 'infra',
          retryable: true,
          fixtures: [SpecCaseId.ProviderFatal401],
        }),
        SurfaceDetector.Unexercised,
      ],
      [
        MalformedSurfaceName.TextNotRendered,
        MalformedSurface.firstItem('reportText', { fixtures: [SpecCaseId.RenderPassedSmoke] }),
        SurfaceDetector.Unexercised,
      ],
    ];
  }

  private static listings(): Malformation[] {
    return [
      [
        MalformedSurfaceName.OptionMissing,
        MalformedSurface.withoutFirst('runOptions'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.OptionUnknown,
        MalformedSurface.firstItem('runOptions', { name: MalformedSurface.unknownOption }),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.OptionTwice,
        MalformedSurface.firstTwice('runOptions'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.DefaultDiffers,
        MalformedSurface.firstItem('runOptions', { default: MalformedSurface.wrongDefault }),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.ValuesDiffer,
        MalformedSurface.named('configFields', 'provider', {
          values: MalformedSurface.wrongProviders,
        }),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.CallOptionMissing,
        MalformedSurface.withoutFirst('callOptions'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.FunctionMissing,
        MalformedSurface.withoutFirst('functions'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.ConfigFieldMissing,
        MalformedSurface.withoutFirst('configFields'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.ProviderMissing,
        MalformedSurface.withoutFirst('providers'),
        SurfaceDetector.SurfaceDrift,
      ],
      [
        MalformedSurfaceName.RetryableMissing,
        MalformedSurface.without('errorKinds', (item) => item.retryable === false),
        SurfaceDetector.SurfaceDrift,
      ],
    ];
  }

  private static firstItem(section: Section, change: Partial<SurfaceItem>): SurfaceManifest {
    const [first, ...rest] = MalformedSurface.base[section];
    return { ...MalformedSurface.base, [section]: [{ ...first, ...change }, ...rest] };
  }

  private static named(
    section: Section,
    name: string,
    change: Partial<SurfaceItem>,
  ): SurfaceManifest {
    return {
      ...MalformedSurface.base,
      [section]: MalformedSurface.base[section].map((item) =>
        item.name === name ? { ...item, ...change } : item,
      ),
    };
  }

  private static firstTwice(section: Section): SurfaceManifest {
    const items = MalformedSurface.base[section];
    return { ...MalformedSurface.base, [section]: [items[0], ...items] };
  }

  private static withoutFirst(section: Section): SurfaceManifest {
    return { ...MalformedSurface.base, [section]: MalformedSurface.base[section].slice(1) };
  }

  private static without(
    section: Section,
    dropped: (item: SurfaceItem) => boolean,
  ): SurfaceManifest {
    return {
      ...MalformedSurface.base,
      [section]: MalformedSurface.base[section].filter((item) => !dropped(item)),
    };
  }
}

export { MalformedSurface };
