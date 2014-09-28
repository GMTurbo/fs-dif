#Fs-Dif
A module that lives on top of a fs module to detect file rename, move, create and delete.

#Renamed:
if file hashes are the same, and the already cached version is stale,
      and the directories of the new and old file are the same, then a rename has occured.
      CACHED VERSION OF FILE MUST BE SPLICED OUT OF CACHE
###caviets: what if you have multiple copied of the same file with different names?

#Moved:
if file hashes are the same, and the already cached version is stale, and the filenames
    are the same, but the directories are different, then a file move has occured.
    CACHED VERSION OF FILE MUST BE SPLICED OUT OF CACHE
###caviets: what if you have multiple copied of the same file with different names?

#Created:
if a file is added to a directory and the file hash doesn't exist in the cache, then add

#Removed:
file should be marked stale and kept in cache.
##REMOVED EVENT IS ALWAYS FIRED BEFORE A RENAME AND MOVED SEQUENCE.
