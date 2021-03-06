//
//  KMPInfo.swift
//  KeymanEngine
//
//  Created by Joshua Horton on 6/2/20.
//  Copyright © 2020 SIL International. All rights reserved.
//

import Foundation

/**
 * This class serializes to and deserializes from JSON following the schema found here for every package's kmp.json:
 * - https://api.keyman.com/schemas/package/1.1.0/package.json
 *
 * It should be kept updated to match the latest schema version whenever updates occur.
 *
 * Documentation link: https://help.keyman.com/developer/current-version/reference/file-types/metadata
 */
class KMPMetadata: Codable {
  var system: KMPSystem
  var options: KMPOptions
  var info: KMPInfo?
  var files: [KMPFile]?
  var keyboards: [KMPKeyboard]?
  var lexicalModels: [KMPLexicalModel]?

  enum CodingKeys: String, CodingKey {
    case system
    case options
    case info
    case files
    case keyboards
    case lexicalModels
    // The following reflect members that may exist, according to our schema,
    // but that are currently unused by Keyman for iOS.
    // case strings
  }

  enum PackageType: String {
    case Keyboard
    case LexicalModel
    case Unsupported
  }

  /**
   * This constructor is designed for use in resource migration needed for the 13.0 -> 14.0
   * cloud resource -> KMP-backed transition.  The result of this constructor is designed to provide
   * a kmp.json "wrapper" for pre-existing cloud resources as if it had come from an actual KMP.
   *
   * As this is constructed from a single instance of LanguageResource, only
   * one language pairing will exist in the newly-constructed KMPMetadata instance.
   *
   * Use of KMPResource.hasMatchingMetadata may help to de-duplicate resources during
   * the migration process.
   */
  internal init(from resource: AnyLanguageResource, packageId: String? = nil) {
    // First, the standard defaults.
    options = KMPOptions()
    keyboards = nil
    lexicalModels = nil

    // If we're constructing one from scratch, set to the absolute minimal version.
    // This will automatically signal that the 'package' needs to be updated.
    info = KMPInfo(version: KMPInfo.AUTOGEN_VERSION)

    // Now to process the resource.
    var fileSet = [ KMPFile(resource.sourceFilename) ]
    resource.fonts.forEach {font in
      fileSet.append(KMPFile(font.source[0]))
    }
    files = fileSet

    if let keyboard = resource as? InstallableKeyboard {
      keyboards = [KMPKeyboard(from: keyboard)!]
      keyboards![0].packageId = packageId
      system = KMPSystem(forPackageType: .Keyboard)!
    } else if let lexicalModel = resource as? InstallableLexicalModel {
      lexicalModels = [KMPLexicalModel(from: lexicalModel)!]
      lexicalModels![0].packageId = packageId
      system = KMPSystem(forPackageType: .LexicalModel)!
    } else {
      fatalError("Cannot utilize unexpected subclass of LanguageResource")
    }
  }

  var isValid: Bool {
    if keyboards != nil && lexicalModels != nil {
      return false
    }

    if keyboards == nil && lexicalModels == nil {
      return false
    }

    return true
  }

  var packageType: PackageType {
    if !isValid {
      return .Unsupported
    } else if keyboards != nil {
      return .Keyboard
    } else if lexicalModels != nil {
      return .LexicalModel
    } else {
      return .Unsupported
    }
  }

  var version: String? {
    return self.info?.version?.description
  }

  /**
   * Notes whether or not this KMPMetadata was autogenerated by KeymanEngine as part of
   * a version migration op.
   */
  var isAutogeneratedWrapper: Bool {
    return version == KMPInfo.AUTOGEN_VERSION.description
  }
}
