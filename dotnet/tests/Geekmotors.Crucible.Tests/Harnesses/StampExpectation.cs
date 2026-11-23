using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using CrucibleAI.Tests.Constants;

namespace CrucibleAI.Tests.Harnesses;

internal static class StampExpectation
{
    private const int FingerprintLength = 8;

    private static readonly CompositeFormat CrucibleLine = CompositeFormat.Parse(StampTexts.CrucibleLineFormat);

    public static string CrucibleLineEnding() =>
        string.Format(
            CultureInfo.InvariantCulture,
            CrucibleLine,
            PackageVersion(),
            Fingerprint(RepositorySchemas.Text(StampTexts.CoherentSchemaFile)),
            Fingerprint(RepositorySchemas.Text(StampTexts.ExtractSchemaFile)));

    private static string PackageVersion() =>
        typeof(Crucible).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .Single(attribute => attribute.Key == StampTexts.SpecMetadataKey).Value![StampTexts.SpecMetadataPrefix.Length..];

    private static string Fingerprint(string text) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..FingerprintLength].ToLowerInvariant();
}
