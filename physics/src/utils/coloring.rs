// physics/src/utils/coloring.rs

/// Organizes constraints into batches where no two constraints in the same batch
/// share a particle. This allows for safe parallel or unrolled execution.
///
/// Returns: (sorted_indices, batch_offsets)
/// - sorted_indices: The original indices reordered by batch.
/// - batch_offsets: The starting index of each batch.
pub fn color_constraints(
    constraints: &[[usize; 2]],
    particle_count: usize
) -> (Vec<usize>, Vec<usize>) {
    let mut particle_last_batch = vec![-1isize; particle_count];
    let mut batches: Vec<Vec<usize>> = Vec::new();

    for (i, &[p1, p2]) in constraints.iter().enumerate() {
        // Find the earliest batch where both particles are free
        let batch_idx_1 = particle_last_batch[p1];
        let batch_idx_2 = particle_last_batch[p2];

        let target_batch = (batch_idx_1.max(batch_idx_2) + 1) as usize;

        // Ensure the batch exists
        if target_batch >= batches.len() {
            batches.resize(target_batch + 1, Vec::new());
        }

        // Assign constraint to batch
        batches[target_batch].push(i);

        // Mark particles as busy in this batch
        particle_last_batch[p1] = target_batch as isize;
        particle_last_batch[p2] = target_batch as isize;
    }

    // Flatten into a single list for cache locality
    let mut sorted_indices = Vec::with_capacity(constraints.len());
    let mut batch_offsets = Vec::new();
    let mut current_offset = 0;

    for batch in batches {
        if batch.is_empty() { continue; }
        batch_offsets.push(current_offset);
        sorted_indices.extend_from_slice(&batch);
        current_offset += batch.len();
    }
    // Push the final end index
    batch_offsets.push(current_offset);

    (sorted_indices, batch_offsets)
}

/// Overload for 3-particle constraints (Triangles/Area)
pub fn color_constraints_3(
    constraints: &[[usize; 3]],
    particle_count: usize
) -> (Vec<usize>, Vec<usize>) {
    let mut particle_last_batch = vec![-1isize; particle_count];
    let mut batches: Vec<Vec<usize>> = Vec::new();

    for (i, &[p1, p2, p3]) in constraints.iter().enumerate() {
        let b1 = particle_last_batch[p1];
        let b2 = particle_last_batch[p2];
        let b3 = particle_last_batch[p3];

        let target_batch = (b1.max(b2).max(b3) + 1) as usize;

        if target_batch >= batches.len() {
            batches.resize(target_batch + 1, Vec::new());
        }

        batches[target_batch].push(i);

        particle_last_batch[p1] = target_batch as isize;
        particle_last_batch[p2] = target_batch as isize;
        particle_last_batch[p3] = target_batch as isize;
    }

    let mut sorted_indices = Vec::with_capacity(constraints.len());
    let mut batch_offsets = Vec::new();
    let mut current_offset = 0;

    for batch in batches {
        if batch.is_empty() { continue; }
        batch_offsets.push(current_offset);
        sorted_indices.extend_from_slice(&batch);
        current_offset += batch.len();
    }
    batch_offsets.push(current_offset);

    (sorted_indices, batch_offsets)
}