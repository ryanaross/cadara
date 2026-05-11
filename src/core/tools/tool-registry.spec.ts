import { test } from "bun:test";

import { expectTrue } from "@/testing/expect.spec";
import {
  getToolById,
  getToolbarSectionsForMode,
  searchToolDefinitions,
} from "@/core/tools/tool-registry";
import { toolIconAssetFileNames } from "@/core/tools/tool-icons";

test("src/core/tools/tool-registry.spec.ts", () => {
  const importTool = getToolById("import");
  const partToolIds = getToolbarSectionsForMode("part").flatMap(
    (section) => section.toolIds,
  );
  const sketchToolIds = getToolbarSectionsForMode("sketch").flatMap(
    (section) => section.toolIds,
  );

  expectTrue(
    importTool.group === "import",
    "Import should register in the import toolbar group.",
  );
  expectTrue(
    importTool.tooltip.includes("image") && importTool.tooltip.includes("mesh"),
    "Import should describe generic supported file categories.",
  );
  expectTrue(
    toolIconAssetFileNames[importTool.icon] === "import-part.svg",
    "Import should use the requested public SVG asset.",
  );
  expectTrue(
    partToolIds.includes("import"),
    "Import should be visible in part mode.",
  );
  expectTrue(
    !sketchToolIds.includes("import"),
    "Import should not be visible while sketching.",
  );
  expectTrue(
    searchToolDefinitions("image").some((tool) => tool.id === "import"),
    "Tool search should discover Import by image intent.",
  );
  expectTrue(
    searchToolDefinitions("mesh").some((tool) => tool.id === "import"),
    "Tool search should discover Import by mesh intent.",
  );
  expectTrue(
    searchToolDefinitions("measure", "part").some(
      (tool) => tool.id === "measure",
    ),
    "Tool search should surface Measure when explicitly searching in part mode.",
  );
  expectTrue(
    searchToolDefinitions("measure", "sketch").length === 0,
    "Tool search should hide part-only tools when scoped to sketch mode.",
  );
  expectTrue(
    searchToolDefinitions("extrude", "sketch").length === 0,
    "Tool search should hide feature tools when scoped to sketch mode.",
  );
  expectTrue(
    searchToolDefinitions("line", "sketch").some((tool) => tool.id === "line"),
    "Tool search should surface sketch tools when scoped to sketch mode.",
  );
});
