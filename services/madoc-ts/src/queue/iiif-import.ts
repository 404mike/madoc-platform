// Import collections
// - Save the collection JSON to disk, without members
// - Create Omeka item
// - Extract all manifest ids and create manifest tasks
// - Extract all collection ids and create collection tasks
// - Once each sub-task is done, import into collection.
// Import manifests
// - Save the manifest JSON to disk, without canvases (and configuration driven for what else to exclude)
// - Save the canvas JSON to disk
// - Create Omeka item
// - Extract all canvas ids and create canvas tasks, pointing to the manifest on disk
// - Once each sub-task is done, add to manifest
// Import canvases
// - Read from disk
// - Create Omeka item
// - Extract image service
// - Create image service task
// - Create thumbnail task
// - Once thumbnails is done and image service task is done, link them all up to the canvas.
// Generate thumbnails
// - medium large and square thumbnails from the image data
// - Create omeka media item
//
//
// Requirements.
// - Connect to database
// - Create Omeka API instance
// - Create worker instance
// - Dispatch to methods below.
// - Streaming JSON parsing

// What we really want is a wrapper for this that will try/catch the whole thing and set the task to errored if it
// fails. If that fails... then log? Or put it in for a retry.
// What does the task look like?
// - We need the collection ID
// - We need any config that would be applied to the manifests / canvas etc.
// - The state will contain the Omeka item eventually
// - The sub tasks will be manifests.
// What will this do?
// - Check if the collection is already in Omeka
// - If it is, load it and check which manifests are in there.
// - Only import missing manifests
// - Do the linking step as normal.

// Task changes
// - Collection created, this function called
// - Collection added to Omeka
// - Manifest 1 from collection, a task is created with ID passed in
// - Manifest 1 creation triggers import
// - Manifest 1 added to Omeka, status moved to ingested
// - Canvas 1 from manifest, a task is created with path to Manifest on disk and ID
// - Canvas 1 creation triggers import
// - Canvas 1 added to Omeka, status moved to ingested
// ...
// - All canvases moved to ingested, manifest subtask listener for ingested called
// - All canvases added to Manifest in Omeka
// ...
// - All manifests moved to ingested, collection subtask listener for ingested called
// - All manifests added to collection in Omeka
// - Collection marked as ingested.
// ...
// - All canvases moved to done, manifest subtask listener for done called
// - Manifest marked as done
// ...
// - All manifests moved to done, collection subtask listener for done called
// - Collection marked as done

// Translates to:

// Collection
// type: collection-import
// statues: waiting, accepted, waiting for canvases, importing canvases, done
// Events:
// - created
// - subtask_type_status.manifest-import.[done]
// Sub task types:
// - manifest-import
// Params:
// - Collection URL
// State:
// - Omeka ID

// Manifest
// type: manifest-import
// Events:
// - created
// - subtask_type_status.canvas-import.[done]
// Sub task types
// - canvas-import
// - thumbnail-generation

// Canvas
// type: canvas-import
// Events
// - created
// - subtask_type_status.canvas-thumbnail-generation.[done]
// Sub task types
// - thumbnail-generation

// Thumbnail generation
// type: thumbnail-generation
// Events
// - created
// };
// const importManifest = () => {};
// const importCanvas = () => {};
// const importImageService = () => {};
// const generateThumbnail = () => {};
