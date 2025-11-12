import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { LuPlus, LuPencil, LuTrash2, LuSave, LuX } from "../components/icons.tsx";

type RateModifier = {
  id: string;
  name: string;
  multiplier: number;
  description?: string;
  isDefault: boolean;
};

export default function RateModifiersManager() {
  const modifiers = useSignal<RateModifier[]>([]);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const editing = useSignal<string | null>(null);
  const editForm = useSignal({
    name: "",
    multiplier: "1.0",
    description: "",
    isDefault: false,
  });

  // Load rate modifiers
  const loadModifiers = async () => {
    try {
      const response = await fetch("/api/v1/rate-modifiers", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load rate modifiers");
      const data = await response.json();
      modifiers.value = data;
      loading.value = false;
    } catch (err) {
      error.value = String(err);
      loading.value = false;
    }
  };

  useEffect(() => {
    loadModifiers();
  }, []);

  const startCreate = () => {
    editing.value = "new";
    editForm.value = {
      name: "",
      multiplier: "1.0",
      description: "",
      isDefault: false,
    };
  };

  const startEdit = (modifier: RateModifier) => {
    editing.value = modifier.id;
    editForm.value = {
      name: modifier.name,
      multiplier: String(modifier.multiplier),
      description: modifier.description || "",
      isDefault: modifier.isDefault,
    };
  };

  const cancelEdit = () => {
    editing.value = null;
  };

  const saveModifier = async () => {
    try {
      const payload = {
        name: editForm.value.name,
        multiplier: parseFloat(editForm.value.multiplier),
        description: editForm.value.description || undefined,
        isDefault: editForm.value.isDefault,
      };

      if (editing.value === "new") {
        const response = await fetch("/api/v1/rate-modifiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to create rate modifier");
      } else {
        const response = await fetch(`/api/v1/rate-modifiers/${editing.value}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to update rate modifier");
      }

      await loadModifiers();
      editing.value = null;
    } catch (err) {
      error.value = String(err);
    }
  };

  const deleteModifier = async (id: string) => {
    if (!confirm("Delete this rate modifier? This cannot be undone.")) return;
    
    try {
      const response = await fetch(`/api/v1/rate-modifiers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete rate modifier");
      }
      
      await loadModifiers();
    } catch (err) {
      alert(String(err));
    }
  };

  if (loading.value) {
    return <div class="loading loading-spinner"></div>;
  }

  return (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-lg font-semibold">Rate Modifiers</h3>
          <p class="text-sm opacity-70">
            Manage job type multipliers for time-based billing (e.g., Holiday 1.5x, Weekend 1.2x)
          </p>
        </div>
        {editing.value !== "new" && (
          <button
            type="button"
            onClick={startCreate}
            class="btn btn-primary btn-sm"
          >
            <LuPlus size={16} />
            Add Modifier
          </button>
        )}
      </div>

      {error.value && (
        <div class="alert alert-error">
          <span>{error.value}</span>
        </div>
      )}

      {editing.value === "new" && (
        <div class="card bg-base-200 shadow-md">
          <div class="card-body">
            <h4 class="card-title">New Rate Modifier</h4>
            <div class="space-y-3">
              <label class="form-control">
                <div class="label">
                  <span class="label-text">Name *</span>
                </div>
                <input
                  type="text"
                  value={editForm.value.name}
                  onInput={(e) =>
                    (editForm.value = { ...editForm.value, name: e.currentTarget.value })}
                  class="input input-bordered"
                  placeholder="e.g., Holiday, Weekend, Overnight"
                />
              </label>

              <label class="form-control">
                <div class="label">
                  <span class="label-text">Multiplier *</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.value.multiplier}
                  onInput={(e) =>
                    (editForm.value = { ...editForm.value, multiplier: e.currentTarget.value })}
                  class="input input-bordered"
                  placeholder="1.0"
                />
                <div class="label">
                  <span class="label-text-alt">
                    1.0 = no change, 1.5 = 50% increase, 2.0 = double
                  </span>
                </div>
              </label>

              <label class="form-control">
                <div class="label">
                  <span class="label-text">Description</span>
                </div>
                <input
                  type="text"
                  value={editForm.value.description}
                  onInput={(e) =>
                    (editForm.value = { ...editForm.value, description: e.currentTarget.value })}
                  class="input input-bordered"
                  placeholder="Optional description"
                />
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.value.isDefault}
                  onChange={(e) =>
                    (editForm.value = { ...editForm.value, isDefault: e.currentTarget.checked })}
                  class="checkbox checkbox-primary"
                />
                <span class="label-text">Set as default modifier</span>
              </label>

              <div class="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelEdit}
                  class="btn btn-ghost btn-sm"
                >
                  <LuX size={16} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveModifier}
                  class="btn btn-primary btn-sm"
                  disabled={!editForm.value.name || !editForm.value.multiplier}
                >
                  <LuSave size={16} />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div class="space-y-2">
        {modifiers.value.map((modifier) =>
          editing.value === modifier.id ? (
            <div key={modifier.id} class="card bg-base-200 shadow-md">
              <div class="card-body">
                <h4 class="card-title">Edit Rate Modifier</h4>
                <div class="space-y-3">
                  <label class="form-control">
                    <div class="label">
                      <span class="label-text">Name *</span>
                    </div>
                    <input
                      type="text"
                      value={editForm.value.name}
                      onInput={(e) =>
                        (editForm.value = { ...editForm.value, name: e.currentTarget.value })}
                      class="input input-bordered"
                    />
                  </label>

                  <label class="form-control">
                    <div class="label">
                      <span class="label-text">Multiplier *</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editForm.value.multiplier}
                      onInput={(e) =>
                        (editForm.value = { ...editForm.value, multiplier: e.currentTarget.value })}
                      class="input input-bordered"
                    />
                  </label>

                  <label class="form-control">
                    <div class="label">
                      <span class="label-text">Description</span>
                    </div>
                    <input
                      type="text"
                      value={editForm.value.description}
                      onInput={(e) =>
                        (editForm.value = { ...editForm.value, description: e.currentTarget.value })}
                      class="input input-bordered"
                    />
                  </label>

                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.value.isDefault}
                      onChange={(e) =>
                        (editForm.value = { ...editForm.value, isDefault: e.currentTarget.checked })}
                      class="checkbox checkbox-primary"
                    />
                    <span class="label-text">Set as default modifier</span>
                  </label>

                  <div class="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      class="btn btn-ghost btn-sm"
                    >
                      <LuX size={16} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveModifier}
                      class="btn btn-primary btn-sm"
                    >
                      <LuSave size={16} />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={modifier.id}
              class="card bg-base-100 border border-base-300 hover:border-primary transition-colors"
            >
              <div class="card-body p-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <h5 class="font-semibold">{modifier.name}</h5>
                      {modifier.isDefault && (
                        <span class="badge badge-primary badge-sm">Default</span>
                      )}
                    </div>
                    <p class="text-sm opacity-70">
                      Multiplier: {modifier.multiplier}x
                      {modifier.description && ` • ${modifier.description}`}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(modifier)}
                      class="btn btn-ghost btn-sm"
                    >
                      <LuPencil size={16} />
                    </button>
                    {!modifier.isDefault && (
                      <button
                        type="button"
                        onClick={() => deleteModifier(modifier.id)}
                        class="btn btn-ghost btn-sm text-error"
                      >
                        <LuTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {modifiers.value.length === 0 && (
        <div class="text-center py-8 opacity-70">
          <p>No rate modifiers defined yet.</p>
          <p class="text-sm">Click "Add Modifier" to create your first one.</p>
        </div>
      )}
    </div>
  );
}
