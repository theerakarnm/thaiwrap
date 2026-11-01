//! Criterion benchmarks: one full wrap of a whole fixture per iteration, per tool x size x max length.
//! Ids are `<tool>/<size>/ml<NN>`; see NOTES.md for where criterion stores each baseline.
use std::hint::black_box;
use std::time::Duration;

use bench_compare::{read_fixture, Tool, Tools, FIXTURES, MAX_LENGTHS};
use criterion::{criterion_group, criterion_main, Criterion};

fn compare(c: &mut Criterion) {
    let tools = Tools::new().unwrap();
    let fixtures: Vec<(&str, String)> = FIXTURES
        .iter()
        .map(|(size, _)| (*size, read_fixture(size).unwrap()))
        .collect();
    for tool in Tool::ALL {
        let mut group = c.benchmark_group(tool.name());
        for (size, text) in &fixtures {
            for max in MAX_LENGTHS {
                group.bench_function(format!("{size}/ml{max}"), |b| {
                    b.iter(|| tools.wrap(tool, black_box(text), black_box(max)).unwrap());
                });
            }
        }
        group.finish();
    }
}

fn config() -> Criterion {
    Criterion::default()
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2))
        .sample_size(50)
}

criterion_group! {
    name = benches;
    config = config();
    targets = compare
}
criterion_main!(benches);
