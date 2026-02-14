import { SetMetadata } from '@nestjs/common';

export const LICENSE_SERVER_URL = 'https://license-forge.com';

export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnYV2BJqLVimrXQ56vlhu
gXeuNV72+3Y8FhU62KD79k/YN8Kzq4LRgaCJjRpog6P1vGO0Vx1/xxjwOzAwjijr
NJlQ1UW6M1uKcJpmh4fJLkbr8l+yZebP6+CIx4O6zQykpf7REFfSYeDiT6HX1Q4i
iu17xHAWZCkkqrfoZQ1QcyXqNPHqlFjaBnBa/2FbRIciC+BT5OmlzgqLpWKLNlNR
ugXfgq//Yh8EcZFhQSX/lrFZ0oiPEPrpL0RpHTNTZEZDO/QTufDhXwnKJ2DjQvaV
jmsgRWLS7lyifsnvU3JNlIZdg7S0QSyYIK0J3doQI43/EXvqkjHIPdNoNJpjkw2W
MwIDAQAB
-----END PUBLIC KEY-----`;

export const VALIDATE_INTERVAL = 86400000; // 24 hours
export const HEARTBEAT_INTERVAL = 86400000; // 24 hours
export const OFFLINE_GRACE_PERIOD = 72; // hours

export const REQUIRE_FEATURE_KEY = 'requireFeature';

export const RequireFeature = (slug: string) => SetMetadata(REQUIRE_FEATURE_KEY, slug);
