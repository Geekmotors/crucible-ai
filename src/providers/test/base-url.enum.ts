enum BaseUrl {
  Local = 'http://localhost:11434/v1',
  LocalWithTrailingSlash = 'http://localhost:11434/v1/',
  LoopbackIpv4 = 'http://127.0.0.1:11434/v1',
  LoopbackIpv4Range = 'http://127.8.9.10:11434/v1',
  LoopbackIpv6 = 'http://[::1]:11434/v1',
  LoopbackIpv6Expanded = 'http://[0:0:0:0:0:0:0:1]:11434/v1',
  LoopbackIpv4Shorthand = 'http://127.1:11434/v1',
  LoopbackUppercase = 'http://LOCALHOST:11434/v1',
  LoopbackLookalikeAddress = 'http://127.0.0.1.gateway.example.com/v1',
  LoopbackLookalikeName = 'http://localhost.gateway.example.com/v1',
  Gateway = 'https://gateway.example.com/v1',
  PlainHttpGateway = 'http://gateway.example.com/v1',
}

export { BaseUrl };
