# Changelog

## 0.1.0 (2026-10-31)


### Features

* **core:** add Thai line break rules ([098e3bf](https://github.com/theerakarnm/thaiwrap/commit/098e3bfb76f7f2cb9a34d7d900b46b7989f3eef7))
* **core:** add workspace and public option types ([6e452ee](https://github.com/theerakarnm/thaiwrap/commit/6e452eec5a017ddd4eeee6c4c6418ee2a491e52c))
* **core:** break lines with the UAX 14 segmenter ([3a01242](https://github.com/theerakarnm/thaiwrap/commit/3a0124257c4f2f0c8034bc9bd5f7d51acb777800))
* **core:** group segmenter breaks into units ([18952d9](https://github.com/theerakarnm/thaiwrap/commit/18952d9f30c3d2ebe9153c5593f8e581c879acd8))
* **core:** split text at hard line breaks ([510f96c](https://github.com/theerakarnm/thaiwrap/commit/510f96c337a3be21fdb38bbdb4bca2395df25ba7))
* **core:** wrap lines greedily with Thai rules ([2bae33a](https://github.com/theerakarnm/thaiwrap/commit/2bae33af7dbb2016e90f1727538e947c94ff2a05))
* **node:** add validated wrapThai binding ([32dd3d7](https://github.com/theerakarnm/thaiwrap/commit/32dd3d7589d82dad9e80fb6ca3cf6cf5eb74f90e))
* thaiwrap v0.1 ([d2ad0e9](https://github.com/theerakarnm/thaiwrap/commit/d2ad0e904d6c114fc7f32ee2a16cda4ba5648a2c))


### Bug Fixes

* **ci:** let release-please label its PR and tag prereleases ([aadf5f7](https://github.com/theerakarnm/thaiwrap/commit/aadf5f72ef4de2279420af44d3a2cdb088fa5113))
* **core:** escape the pipe in rolled-up sub-category cells ([187f4cd](https://github.com/theerakarnm/thaiwrap/commit/187f4cd830da2b7458ab2ee0e5a90579d4316e78))
* **core:** keep line breaks on grapheme cluster boundaries ([596158c](https://github.com/theerakarnm/thaiwrap/commit/596158ca77d397372b66c1a6c96d1304506ac6f4))
* **core:** mark a combining mark only where it is shown alone ([d669b21](https://github.com/theerakarnm/thaiwrap/commit/d669b2119dff08d51ff1822e2da75f74b7d8025b))
* **node:** export only wrapThai from the package entry ([990d803](https://github.com/theerakarnm/thaiwrap/commit/990d80301ce293c0bf36f237bf3e241568d6a74f))
* **node:** name bigint in the maxLength type error ([c89e91d](https://github.com/theerakarnm/thaiwrap/commit/c89e91d9feaab008610de24b16b7760e75886ced))
* **node:** show maxLength the way JS prints it ([da1e51f](https://github.com/theerakarnm/thaiwrap/commit/da1e51f3262aae97bbc88dd6b511bac96b4076b0))
* **test:** compare the word segmenter with the line segmenter again ([183edb6](https://github.com/theerakarnm/thaiwrap/commit/183edb67532a4b6e07a29aae8a780492c2156332))


### Performance Improvements

* add Rust and JS benchmarks ([6adf0b6](https://github.com/theerakarnm/thaiwrap/commit/6adf0b64601f9cc128ee2067ef9d7d53392c36cb))
