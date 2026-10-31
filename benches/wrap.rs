use std::hint::black_box;

use criterion::{criterion_group, criterion_main, Criterion};
use thaiwrap_core::{wrap, Measure, WrapOptions};

const SHORT: &str = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
const MIXED: &str = "ราคา 1,250.50 บาท ใช้ React กับ TypeScript 👍 สวัสดี! (ภาษาไทย) ";

fn benches(c: &mut Criterion) {
    let long = SHORT.repeat(300);
    let mixed = MIXED.repeat(50);
    let default = WrapOptions::default();
    let mut graphemes = WrapOptions::default();
    graphemes.measure = Measure::Graphemes;
    c.bench_function("short", |b| b.iter(|| wrap(black_box(SHORT), 10, &default)));
    c.bench_function("long", |b| b.iter(|| wrap(black_box(&long), 10, &default)));
    c.bench_function("mixed", |b| {
        b.iter(|| wrap(black_box(&mixed), 20, &default))
    });
    c.bench_function("overflow_max4", |b| {
        b.iter(|| wrap(black_box(&long), 4, &default))
    });
    c.bench_function("graphemes_long", |b| {
        b.iter(|| wrap(black_box(&long), 10, &graphemes))
    });
}

criterion_group!(group, benches);
criterion_main!(group);
