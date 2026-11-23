using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using CrucibleAI.Payloads;

namespace CrucibleAI.Reports;

internal sealed class JudgeStampFactory
{
    private const int FingerprintLength = 8;
    private const char BuildMetadataMark = '+';

    private static readonly Assembly Package = typeof(JudgeStampFactory).Assembly;

    public JudgeStamp For(string provider, string? model) =>
        new(Package.GetName().Name ?? string.Empty, Version(), provider, model, Fingerprint(JudgeSchemas.Coherent), Fingerprint(JudgeSchemas.Extract));

    private static string Version()
    {
        var version = Package.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? string.Empty;
        var mark = version.IndexOf(BuildMetadataMark, StringComparison.Ordinal);
        return mark < 0 ? version : version[..mark];
    }

    private static string Fingerprint(string schema) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(schema)))[..FingerprintLength].ToLowerInvariant();
}
