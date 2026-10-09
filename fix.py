import os
import re

path = 'src/features/lists/ListsView.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace ScanGroceryModal import
content = content.replace(
    "import { ScanGroceryModal } from './ScanGroceryModal';",
    "import { downscaleImage } from '@/ai';\nimport { ImagePlus, X } from 'lucide-react';"
)

# Update interface
content = content.replace(
    "interface AddGroceryForm {\n  name: string;\n  category: string;\n  addedBy: string;\n}",
    "interface AddGroceryForm {\n  name: string;\n  category: string;\n  addedBy: string;\n  photo?: string;\n}"
)

# Update state
content = content.replace(
    "    name: '',\n    category: 'Produce',\n    addedBy: members[0]?.name ?? 'You',\n  });",
    "    name: '',\n    category: 'Produce',\n    addedBy: members[0]?.name ?? 'You',\n    photo: undefined,\n  });"
)

# Update reset
content = content.replace(
    "    setForm({\n      name: '',\n      category: 'Produce',\n      addedBy: members[0]?.name ?? 'You',\n    });",
    "    setForm({\n      name: '',\n      category: 'Produce',\n      addedBy: members[0]?.name ?? 'You',\n      photo: undefined,\n    });"
)

# Add file UI
old_ui = '          <label className="form-field">\n            Item name'
new_ui = """          <label className="form-field">
            Photo (Optional)
            {form.photo ? (
              <div className="relative w-24 h-24">
                <img src={form.photo} alt="Item" className="w-full h-full object-cover rounded-md border border-border" />
                <button type="button" onClick={() => setForm(f => ({ ...f, photo: undefined }))} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 cursor-pointer">
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="h-20 w-full max-w-sm rounded-md border border-dashed border-input bg-background flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-secondary/20 transition-colors text-muted-foreground">
                <ImagePlus className="size-6" />
                <span className="text-xs">Attach a photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { dataUrl } = await downscaleImage(file, 400);
                      setForm(f => ({ ...f, photo: dataUrl }));
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
              </label>
            )}
          </label>

          <label className="form-field">
            Item name"""
content = content.replace(old_ui, new_ui)

# Update saved grocery item with photo
content = content.replace(
    "        name: item.name,\n        category: item.category,\n        addedBy: item.addedBy,\n        checked: false,",
    "        name: item.name,\n        category: item.category,\n        addedBy: item.addedBy,\n        photo: item.photo,\n        checked: false,"
)

# Display photo in list
content = content.replace(
    '                <div className="flex flex-col flex-1">\n                  <span className={`font-semibold ${item.checked ? \'line-through text-muted-foreground\' : \'text-foreground\'}`}>\n                    {item.name}\n                  </span>',
    '                {item.photo && (\n                  <img src={item.photo} alt={item.name} className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />\n                )}\n                <div className="flex flex-col flex-1">\n                  <span className={`font-semibold ${item.checked ? \'line-through text-muted-foreground\' : \'text-foreground\'}`}>\n                    {item.name}\n                  </span>'
)

# Remove ScanGroceryModal state
content = content.replace("  const [scanGroceryOpen, setScanGroceryOpen] = useState(false);\n", "")

# Replace camera buttons logic
content = re.sub(r'onClick=\{\(\) => setScanGroceryOpen\(true\)\}', 'onClick={() => setAddGroceryOpen(true)}', content)

# Remove modal component entirely
content = re.sub(r'<ScanGroceryModal\s*open=\{scanGroceryOpen\}.*?\/>', '', content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
