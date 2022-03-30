import React, { useCallback, useEffect, useState } from "react";
import { TextField, TextFieldProps } from "@material-ui/core";

function extractTagsFromString(value: string) {
    const splitTags = value.split(' ').join('').split(',');
    const tags = [];

    for (const tag of splitTags) {
        tags.push(tag.trim());
    }

    return tags;
}

export interface Props {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

export default function TagsTextField({tags, onTagsChange, ...props}: Props & TextFieldProps) {
    const [value, setValue] = useState('');

    useEffect(() => {
        const tagsString = tags.join(', ');

        if (tagsString !== value) {
            setValue(tags.join(', '));
        }
    }, [value, tags]);

    const handleChange = useCallback((e) => {
        let currentValue = e.target.value;

        if (
            value.length > currentValue.length &&
            value.includes(currentValue) &&
            currentValue.endsWith(',')
        ) {
            // Detected a backspace at the last comma, move cursor back enough to remove the comma
            currentValue = currentValue.substring(0, currentValue.length - 1);
        }

        // Decompose string into individual tags by removing all spaces and splitting on ","
        const newTags = extractTagsFromString(currentValue);
        setValue(newTags.join(', '));
        onTagsChange(newTags);
    }, [value, onTagsChange]);

    return (
        <TextField
            {...props}
            value={value}
            onChange={handleChange}
        />
    );
}
